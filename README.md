# Sketchfab-Model-Texture-Ripper

A userscript that allows you to download 3D models from Sketchfab along with their textures.
Optimized version https://github.com/gamedev44/Fabulous-Ripper

## 🎯 Features

- ✅ Download 3D models in OBJ format
- ✅ Capture and save textures automatically
- ✅ Multiple download options (OBJ only, with textures, or individual files)
- ✅ Non-blocking ZIP creation using Web Workers
- ✅ Real-time progress indicators
- ✅ Automatic duplicate detection
- ✅ Memory-optimized for large models

## 📦 Installation

### Prerequisites

You need a userscript manager extension installed in your browser:

| Browser | Extension |
|---------|-----------|
| **Chrome/Edge/Brave** | [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| **Firefox** | [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) or [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) |
| **Safari** | [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) |
| **Opera** | [Tampermonkey](https://addons.opera.com/en/extensions/details/tampermonkey-beta/) |

### Installing the Script

1. **Install Tampermonkey** (or any userscript manager) from the links above

2. **Click on the Tampermonkey icon** in your browser toolbar and select **"Create a new script..."**

3. **Delete all default code** and paste the entire script code

4. **Save the script** using:
   - Windows/Linux: `Ctrl+S` 
   - Mac: `Cmd+S`

5. The script will automatically activate when you visit Sketchfab

## 🚀 Usage

### Basic Steps

1. **Navigate to any model** on [Sketchfab](https://www.sketchfab.com)

2. **Wait for the model to load** completely

3. **Rotate/interact with the 3D view** 
   > ⚠️ **Important!** The script captures geometry data as it renders

4. **Look for download buttons** in the top toolbar:

   | Button | Description |
   |--------|-------------|
   | 🔴 **ZIP** | Downloads models + textures in a ZIP |
   | 🟠 **FILES** | Opens a dialog with individual download links |

5. **Click your preferred download option**

### Download Options Explained

| Button | Contents | Best For |
|--------|----------|----------|
| **ZIP+TEX** | Models + textures | Complete asset with materials |
| **FILES** | Individual links | Selective downloading, troubleshooting |

### Important Notes

> ⚠️ **MUST INTERACT WITH MODEL FIRST**
> 
> The script captures data during rendering. Make sure to:
> - Rotate the model 360°
> - Zoom in/out
> - Let animations play if present

## 🔧 Troubleshooting

### No Download Buttons Appear

1. **Refresh the page** and wait for full load
2. **Check browser console** (`F12`) for errors
3. **Verify Tampermonkey is enabled** (icon should be colored, not gray)
4. **Try a different model** - some may be protected

### "No models captured" Alert

- The 3D view must be interacted with first
- Try rotating the model in all directions
- Zoom in and out
- Wait a few seconds after interaction

### Browser Freezes/Crashes

If you experience memory issues:

1. Use the **FILES** option and download selectively
2. The script limits capture to 200 models by default

### Download Produces Empty/Corrupt Files

- Let the model fully load before downloading
- Check the counter - ensure models were captured
- Try the **FILES** option to download individually
- Some complex models may not export correctly

## 🔬 Technical Details

### Limitations

| Limitation | Details |
|------------|---------|
| **Format** | Exports OBJ only (no FBX, GLTF, etc.) |
| **Animations** | Not captured (static models only) |
| **Materials** | Basic material info only |
| **Lights/Cameras** | Not exported |
| **Protected Models** | Encrypted models won't work |

### File Structure

downloaded_file.zip 
├── models/

│ ├── model_0.obj

│ ├── model_1.obj

│ └── ...

└── textures/

├── texture_name.png

└── ...

## 💻 Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ **Full** | Recommended |
| Firefox | ✅ **Full** | Works great |
| Edge | ✅ **Full** | Chromium-based |
| Safari | ⚠️ **Partial** | May have issues with large models |
| Opera | ✅ **Full** | Chromium-based |

## ⚖️ Legal Disclaimer

> ⚠️ **IMPORTANT**: This tool is for educational purposes only.

- Always respect the intellectual property rights of model creators
- Check the license of each model before downloading
- Many models on Sketchfab are NOT free to use commercially
- Get permission from creators when required
- Consider supporting creators by purchasing their models

## 🐛 Known Issues

- Very large models (>5M vertices) may be skipped
- Some textures might not capture correctly
- Embedded/iframe models won't work
- Private models require authentication

## 🤝 Contributing

Found a bug or have a suggestion? Please open an issue on GitHub!

## 👏 Credits

- **Original author**: Risk
- **Optimizations and fixes**: Community contributors
- **Technique**: Based on WebGL hook injection

## 📄 License

This userscript is provided as-is for educational purposes. Use at your own risk.

---

<div align="center">

**Remember: Always respect content creators and their licensing terms!** 🎨

</div>
