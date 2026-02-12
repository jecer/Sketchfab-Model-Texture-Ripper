// ==UserScript==
// @name         sketchfab fixed v5
// @version      1.0.5
// @description  download sketchfab models (worker ZIP)
// @author       shitposting goddess + fixes
// @include      /^https?://(www\.)?sketchfab\.com/.*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    const window = unsafeWindow;
    console.log("[UserScript] init");

    const CONFIG = {
        MAX_MODELS: 200,
        MAX_VERTICES: 500000,
        MAX_FACES: 200000,
        BATCH_SIZE: 3,
        BATCH_DELAY: 150
    };

    const state = {
        buttonAdded: false,
        imageCache: {},
        objects: {},
        modelSet: new Set(),
        isDownloading: false,
        objFiles: []
    };

    window.allmodel = [];

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getModelId = (obj) => {
        const vertices = obj._attributes?.Vertex?._elements;
        if (!vertices || vertices.length === 0) return null;
        return `${vertices.length}_${vertices.slice(0, 9).join(',')}`;
    };

    // ==================== UI ====================
    const createUI = () => {
        let counter = document.getElementById('sketchfab-counter');
        if (!counter) {
            counter = document.createElement('div');
            counter.id = 'sketchfab-counter';
            counter.style.cssText = `
                position: fixed;
                top: 40px;
                right: 10px;
                background: rgba(0,0,0,0.8);
                color: #0f0;
                padding: 8px 12px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 12px;
                z-index: 99999;
            `;
            document.body.appendChild(counter);
        }
    };

    const updateCounter = () => {
        const counter = document.getElementById('sketchfab-counter');
        if (counter) {
            counter.innerHTML = `Models: ${window.allmodel.length}<br>Textures: ${Object.keys(state.imageCache).length}`;
        }
    };

    const showStatus = (html) => {
        let status = document.getElementById('sketchfab-status');
        if (!status) {
            status = document.createElement('div');
            status.id = 'sketchfab-status';
            status.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.95);
                color: white;
                padding: 25px 35px;
                border-radius: 12px;
                font-family: Arial, sans-serif;
                font-size: 14px;
                z-index: 999999;
                text-align: center;
                min-width: 320px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            `;
            document.body.appendChild(status);
        }
        status.style.display = 'block';
        status.innerHTML = html;
    };

    const hideStatus = () => {
        const el = document.getElementById('sketchfab-status');
        if (el) el.style.display = 'none';
    };

    // ==================== КНОПКИ ====================
    const addDownloadButton = () => {
        if (state.buttonAdded) return;

        const titlebar = document.querySelector('.titlebar') ||
                        document.querySelector('.model-page__info');

        if (!titlebar) {
            setTimeout(addDownloadButton, 1000);
            return;
        }

        const btnZip = document.createElement('a');
        btnZip.className = 'control';
        btnZip.innerHTML = '<pre style="color:red;cursor:pointer;">ZIP | </pre>';
        btnZip.onclick = () => startDownload('zip');
        titlebar.appendChild(btnZip);

        const btnSeparate = document.createElement('a');
        btnSeparate.className = 'control';
        btnSeparate.innerHTML = '<pre style="color:orange;cursor:pointer;">FILES</pre>';
        btnSeparate.onclick = () => startDownload('separate');
        titlebar.appendChild(btnSeparate);

        state.buttonAdded = true;
        createUI();
    };

    // ==================== ПАРСЕР ====================
    const parseGeometry = (obj) => {
        if (!obj._primitives) return null;

        const primitives = [];
        let totalFaces = 0;

        for (const p of obj._primitives) {
            if (p?.indices?._elements) {
                totalFaces += Math.floor(p.indices._elements.length / 3);
                primitives.push({ mode: p.mode, indices: p.indices._elements });
            }
        }

        if (totalFaces > CONFIG.MAX_FACES) return null;

        const attr = obj._attributes;
        if (!attr?.Vertex?._elements) return null;
        if (attr.Vertex._elements.length > CONFIG.MAX_VERTICES) return null;

        let uv = [];
        for (let i = 0; i <= 8; i++) {
            if (attr[`TexCoord${i}`]?._elements) {
                uv = attr[`TexCoord${i}`]._elements;
                break;
            }
        }

        return {
            vertex: attr.Vertex._elements,
            normal: attr.Normal?._elements || [],
            uv,
            primitives
        };
    };

    const generateOBJ = (name, g) => {
        const { vertex, normal, uv, primitives } = g;
        const lines = [`mtllib ${name}.mtl`, `o ${name}`];

        for (let i = 0; i < vertex.length; i += 3) {
            lines.push(`v ${vertex[i]} ${vertex[i+1]} ${vertex[i+2]}`);
        }
        for (let i = 0; i < normal.length; i += 3) {
            lines.push(`vn ${normal[i]} ${normal[i+1]} ${normal[i+2]}`);
        }
        for (let i = 0; i < uv.length; i += 2) {
            lines.push(`vt ${uv[i]} ${uv[i+1]}`);
        }

        lines.push('s on');

        const hasN = normal.length > 0, hasUV = uv.length > 0;

        for (const prim of primitives) {
            if (prim.mode !== 4 && prim.mode !== 5) continue;
            const isStrip = prim.mode === 5;
            const idx = prim.indices;

            for (let j = 0; j + 2 < idx.length; isStrip ? j++ : j += 3) {
                const ord = (isStrip && j % 2) ? [0, 2, 1] : [0, 1, 2];
                let f = 'f';
                for (const k of ord) {
                    const v = idx[j + k] + 1;
                    f += ` ${v}${(hasN || hasUV) ? '/' + (hasUV ? v : '') + (hasN ? '/' + v : '') : ''}`;
                }
                lines.push(f);
            }
        }

        return lines.join('\n');
    };

    // ==================== WEB WORKER ДЛЯ ZIP ====================
    const createZipInWorker = (files, textures) => {
        return new Promise((resolve, reject) => {
            // Код воркера
            const workerCode = `
                importScripts('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');

                self.onmessage = async function(e) {
                    const { files, textures } = e.data;

                    try {
                        const zip = new JSZip();
                        const modelsFolder = zip.folder('models');
                        const texturesFolder = zip.folder('textures');

                        // Добавляем OBJ файлы
                        for (let i = 0; i < files.length; i++) {
                            modelsFolder.file(files[i].name, files[i].content);

                            if (i % 10 === 0) {
                                self.postMessage({ type: 'progress', stage: 'models', current: i + 1, total: files.length });
                            }
                        }

                        // Добавляем текстуры
                        for (let i = 0; i < textures.length; i++) {
                            texturesFolder.file(textures[i].name, textures[i].data, { binary: true });

                            if (i % 3 === 0) {
                                self.postMessage({ type: 'progress', stage: 'textures', current: i + 1, total: textures.length });
                            }
                        }

                        self.postMessage({ type: 'progress', stage: 'zip', current: 0, total: 100 });

                        // Генерируем ZIP
                        const blob = await zip.generateAsync(
                            { type: 'blob', compression: 'STORE' },
                            (meta) => {
                                self.postMessage({ type: 'progress', stage: 'zip', current: Math.round(meta.percent), total: 100 });
                            }
                        );

                        self.postMessage({ type: 'done', blob: blob });

                    } catch (err) {
                        self.postMessage({ type: 'error', message: err.message });
                    }
                };
            `;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            const worker = new Worker(workerUrl);

            worker.onmessage = (e) => {
                const { type, stage, current, total, blob: resultBlob, message } = e.data;

                if (type === 'progress') {
                    if (stage === 'models') {
                        showStatus(`Adding models to ZIP...<br>${current} / ${total}`);
                    } else if (stage === 'textures') {
                        showStatus(`Adding textures to ZIP...<br>${current} / ${total}`);
                    } else if (stage === 'zip') {
                        showStatus(`Compressing ZIP...<br>${current}%`);
                    }
                } else if (type === 'done') {
                    worker.terminate();
                    URL.revokeObjectURL(workerUrl);
                    resolve(resultBlob);
                } else if (type === 'error') {
                    worker.terminate();
                    URL.revokeObjectURL(workerUrl);
                    reject(new Error(message));
                }
            };

            worker.onerror = (err) => {
                worker.terminate();
                URL.revokeObjectURL(workerUrl);
                reject(err);
            };

            // Запускаем воркер
            worker.postMessage({ files, textures });
        });
    };

    // Конвертируем blob в ArrayBuffer для передачи в worker
    const blobToArrayBuffer = (blob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
    };

    // ==================== СКАЧИВАНИЕ ====================
    const startDownload = async (mode) => {
        if (state.isDownloading) return alert('Already downloading!');
        if (!window.allmodel.length) return alert('No models! Rotate the view first.');

        state.isDownloading = true;

        try {
            await generateAllOBJ();

            if (mode === 'zip') {
                await downloadAsZipWorker();
            } else {
                await downloadSeparately();
            }
        } catch (err) {
            console.error(err);
            showStatus(`<span style="color:#f66">Error: ${err.message}</span><br><br>
                       <button onclick="document.getElementById('sketchfab-status').style.display='none'"
                               style="padding:8px 20px;cursor:pointer;border:none;border-radius:5px;">OK</button>`);
        } finally {
            state.isDownloading = false;
        }
    };

    const generateAllOBJ = async () => {
        state.objFiles = [];
        const models = window.allmodel;
        let saved = 0;

        for (let i = 0; i < models.length; i++) {
            showStatus(`Generating OBJ...<br>${i + 1} / ${models.length}`);

            try {
                const geom = parseGeometry(models[i]);
                if (geom) {
                    const content = generateOBJ(`model_${saved}`, geom);
                    state.objFiles.push({ name: `model_${saved}.obj`, content });
                    saved++;
                }
            } catch (e) {
                console.warn('Skip model', i, e);
            }

            if (i % CONFIG.BATCH_SIZE === 0) await sleep(CONFIG.BATCH_DELAY);
        }
    };

    // ==================== ZIP ЧЕРЕЗ WORKER ====================
    const downloadAsZipWorker = async () => {
        showStatus(`Preparing textures for ZIP...`);

        // Конвертируем текстуры в ArrayBuffer
        const textures = [];
        const texNames = Object.keys(state.objects);

        for (let i = 0; i < texNames.length; i++) {
            const name = texNames[i];
            const blob = state.objects[name];

            if (blob) {
                showStatus(`Preparing textures...<br>${i + 1} / ${texNames.length}`);
                const arrayBuffer = await blobToArrayBuffer(blob);
                textures.push({ name, data: arrayBuffer });
            }

            await sleep(10);
        }

        showStatus(`Starting ZIP worker...`);

        // Создаём ZIP в воркере
        const zipBlob = await createZipInWorker(state.objFiles, textures);

        const fileName = (document.querySelector('.model-name__label')?.textContent || 'model')
            .trim().replace(/[<>:"/\\|?*]/g, '_');

        saveAs(zipBlob, `${fileName}.zip`);

        showStatus(`<span style="color:#4f8">✓ Downloaded!</span><br>${formatBytes(zipBlob.size)}`);
        setTimeout(hideStatus, 2000);
    };

    // ==================== РАЗДЕЛЬНОЕ СКАЧИВАНИЕ ====================
    const downloadSeparately = async () => {
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a1a;
            padding: 20px;
            border-radius: 10px;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 999999;
            min-width: 400px;
            color: white;
            font-family: Arial;
        `;

        container.innerHTML = `
            <h3 style="margin:0 0 15px 0;">Download Files (${state.objFiles.length} models, ${Object.keys(state.objects).length} textures)</h3>
            <div style="display:flex;gap:10px;margin-bottom:15px;">
                <button id="dl-all-obj" style="flex:1;padding:10px;cursor:pointer;background:#4CAF50;border:none;color:white;border-radius:5px;">
                    Download All OBJ
                </button>
                <button id="dl-all-tex" style="flex:1;padding:10px;cursor:pointer;background:#2196F3;border:none;color:white;border-radius:5px;">
                    Download All Textures
                </button>
            </div>
            <div id="file-list" style="max-height:300px;overflow-y:auto;"></div>
            <button id="dl-close" style="width:100%;margin-top:15px;padding:10px;cursor:pointer;background:#666;border:none;color:white;border-radius:5px;">
                Close
            </button>
        `;

        document.body.appendChild(container);
        hideStatus();

        const list = container.querySelector('#file-list');

        state.objFiles.forEach((f) => {
            const blob = new Blob([f.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            list.innerHTML += `<a href="${url}" download="${f.name}" style="display:block;color:#8f8;margin:3px 0;">${f.name}</a>`;
        });

        Object.entries(state.objects).forEach(([name, blob]) => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                list.innerHTML += `<a href="${url}" download="${name}" style="display:block;color:#88f;margin:3px 0;">${name}</a>`;
            }
        });

        container.querySelector('#dl-all-obj').onclick = async () => {
            for (const f of state.objFiles) {
                const blob = new Blob([f.content], { type: 'text/plain' });
                saveAs(blob, f.name);
                await sleep(300);
            }
        };

        container.querySelector('#dl-all-tex').onclick = async () => {
            for (const [name, blob] of Object.entries(state.objects)) {
                if (blob) {
                    saveAs(blob, name);
                    await sleep(300);
                }
            }
        };

        container.querySelector('#dl-close').onclick = () => container.remove();
    };

    // ==================== ХУКИ ====================
    window.attachbody = function(obj) {
        if (obj._faked) return;

        const hasName = obj.stateset?._name || obj._name || obj._parents?.[0]?._name;
        if (!hasName) return;
        if (obj._name === 'composer layer' || obj._name === 'Ground - Geometry') return;

        const id = getModelId(obj);
        if (!id || state.modelSet.has(id)) return;
        if (window.allmodel.length >= CONFIG.MAX_MODELS) return;

        state.modelSet.add(id);
        obj._faked = true;
        window.allmodel.push(obj);
        updateCounter();
    };

    window.drawhookcanvas = function(e, imageModel) {
        if ([32, 64, 128].includes(e.width) && [32, 64, 128].includes(e.height)) return e;
        if (!imageModel) return e;

        const alpha = e.options?.format;
        let best = e, maxSize = 0;

        imageModel.attributes?.images?.forEach(img => {
            const alphaOk = alpha === 'A' ? img.options?.format === alpha : true;
            let d = img.width;
            while (d % 2 === 0) d /= 2;
            if (img.size > maxSize && alphaOk && d === 1) {
                maxSize = img.size;
                best = img;
            }
        });

        if (!state.imageCache[best.url]) {
            state.imageCache[best.url] = { name: imageModel.attributes?.name };
            updateCounter();
        }
        return best;
    };

    window.drawhookimg = function(gl, t) {
        const url = t[5]?.currentSrc;
        if (!url || !state.imageCache[url]) return;

        const w = t[5].width, h = t[5].height;
        if (w * h > 4096 * 4096) return;

        const data = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);

        const half = h >> 1, row = w * 4, tmp = new Uint8Array(row);
        for (let y = 0; y < half; y++) {
            const top = y * row, bot = (h - y - 1) * row;
            tmp.set(data.subarray(top, top + row));
            data.copyWithin(top, bot, bot + row);
            data.set(tmp, bot);
        }

        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        const img = ctx.createImageData(w, h);
        img.data.set(data);
        ctx.putImageData(img, 0, 0);

        let name = (state.imageCache[url].name || 'tex').replace(/\.(png|jpg|jpeg)$/i, '') + '.png';
        c.toBlob(blob => { state.objects[name] = blob; }, 'image/png');
    };

    // ==================== ПЕРЕХВАТ ====================
    const PATTERNS = {
        renderInto1: [/A\.renderInto\(n,E,R/g, /x\.renderInto\(n,S,y/g, /\w\.renderInto\(\w,\w,\w/g],
        renderInto2: /g\.renderInto=function\(e,i,r/g,
        drawArrays: /t\.drawArrays\(t\.TRIANGLES,0,6\)/g,
        getResourceImage: /getResourceImage:function\(e,t\){/g,
        drawGeometry: /(this\._stateCache\.drawGeometry\(this\._graphicContext,t\))/g
    };

    const patchScript = (js) => {
        let m = js;

        for (const p of PATTERNS.renderInto1) {
            p.lastIndex = 0;
            const match = p.exec(m);
            if (match) {
                m = m.slice(0, match.index + match[0].length) + ',i' + m.slice(match.index + match[0].length);
                break;
            }
        }

        let match = PATTERNS.renderInto2.exec(m);
        if (match) m = m.slice(0, match.index + match[0].length) + ',image_data' + m.slice(match.index + match[0].length);

        match = PATTERNS.drawArrays.exec(m);
        if (match) m = m.slice(0, match.index + match[0].length) + ',window.drawhookimg(t,image_data)' + m.slice(match.index + match[0].length);

        match = PATTERNS.getResourceImage.exec(m);
        if (match) m = m.slice(0, match.index + match[0].length) + 'e=window.drawhookcanvas(e,this._imageModel);' + m.slice(match.index + match[0].length);

        match = PATTERNS.drawGeometry.exec(m);
        if (match) {
            m = m.slice(0, match.index + match[1].length) + ';window.attachbody(t);' + m.slice(match.index + match[1].length);
            setTimeout(addDownloadButton, 2000);
        }

        return m;
    };

    new MutationObserver(muts => {
        for (const mut of muts) {
            for (const node of mut.addedNodes) {
                if (node.tagName !== 'SCRIPT' || !node.src) continue;
                if (!node.src.includes('web/dist/') && !node.src.includes('standaloneViewer')) continue;

                const xhr = new XMLHttpRequest();
                xhr.open('GET', node.src, false);
                xhr.send();

                const s = document.createElement('script');
                s.textContent = patchScript(xhr.responseText);
                document.head.appendChild(s);
                node.remove();
            }
        }
    }).observe(document, { childList: true, subtree: true });

    setInterval(() => {
        if (!state.buttonAdded && window.allmodel.length > 0) addDownloadButton();
    }, 2000);

})();