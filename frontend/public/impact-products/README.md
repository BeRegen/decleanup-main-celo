# Impact Product Images

## 🚀 Recommended: Use IPFS

**We recommend uploading images to IPFS for production use.** This provides:
- Decentralized storage
- Permanent URLs
- Better performance
- Onchain compatibility

### Upload to IPFS

1. Visit `/admin/upload-impact-products` in your app
2. Select all 10 PNG images (one for each level)
3. Optionally select the GIF animation for level 10
4. Click "Upload to IPFS"
5. Copy the IPFS CIDs and add to your environment variables:
   ```env
   NEXT_PUBLIC_IMPACT_IMAGES_CID=your_images_cid_here
   NEXT_PUBLIC_IMPACT_METADATA_CID=your_metadata_cid_here
   ```

The component will automatically use IPFS URLs when these environment variables are set.

---

## 📁 Local Fallback (Development Only)

For local development, you can place images in this directory:

### Required Files

### PNG Images (Levels 1-10)
- `IP1.png` - Level 1 Impact Product image
- `IP2.png` - Level 2 Impact Product image
- `IP3.png` - Level 3 Impact Product image
- `IP4.png` - Level 4 Impact Product image
- `IP5.png` - Level 5 Impact Product image
- `IP6.png` - Level 6 Impact Product image
- `IP7.png` - Level 7 Impact Product image
- `IP8.png` - Level 8 Impact Product image
- `IP9.png` - Level 9 Impact Product image
- `IP10.png` - Level 10 Impact Product image (placeholder, GIF is used for animation)

### Animation (Level 10)
- `IP10.gif` - Level 10 Impact Product animation (GIF file)

### File Structure

```
frontend/public/impact-products/
├── IP1.png
├── IP2.png
├── IP3.png
├── IP4.png
├── IP5.png
├── IP6.png
├── IP7.png
├── IP8.png
├── IP9.png
├── IP10.png
└── IP10.gif
```

## Notes

- **Priority**: IPFS URLs (from env vars) > Local paths (this directory)
- Images will be automatically loaded from `/impact-products/IP{level}.png` if IPFS is not configured
- For level 10, the GIF animation (`IP10.gif`) will be displayed instead of the PNG
- Recommended image dimensions: 512x512px or higher (square aspect ratio)
- GIF should be optimized for web (under 5MB recommended)

