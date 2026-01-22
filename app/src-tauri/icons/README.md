# App Icons

Place your app icons in this directory. Required files:

- `icon.png` - Base icon (512x512 or larger)
- `32x32.png` - 32x32 icon
- `128x128.png` - 128x128 icon
- `128x128@2x.png` - 256x256 icon (2x scale)
- `icon.icns` - macOS icon bundle
- `icon.ico` - Windows icon

## Generating Icons

You can use the Tauri CLI to generate all icon sizes from a single source:

```bash
pnpm tauri icon path/to/icon.png
```

Or use an online tool like:
- https://www.iconifier.net
- https://cloudconvert.com/png-to-ico

## Temporary Workaround

For development builds without proper icons, you can use any 512x512 PNG as `icon.png` and the build will work (though with missing icons on some platforms).
