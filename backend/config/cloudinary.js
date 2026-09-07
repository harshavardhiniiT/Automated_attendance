const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Delete an image from Cloudinary by its public ID or photo URL.
 * @param {string} publicIdOrUrl - The Cloudinary public_id or image URL
 * @returns {Promise<object>} Cloudinary destroy result
 */
const deleteFromCloudinary = async (publicIdOrUrl) => {
  if (!publicIdOrUrl) return null;
  let publicId = publicIdOrUrl;

  // Extract public_id if full URL passed
  if (publicIdOrUrl.includes('cloudinary.com')) {
    try {
      const parts = publicIdOrUrl.split('/upload/');
      if (parts.length > 1) {
        const pathAfterUpload = parts[1].replace(/^v\d+\//, ''); // Strip version tag v1234/
        publicId = pathAfterUpload.substring(0, pathAfterUpload.lastIndexOf('.')) || pathAfterUpload;
      }
    } catch (e) {
      console.error('Failed to parse Cloudinary URL:', e.message);
    }
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
    });
    console.log(`🗑️ Cloudinary delete [${publicId}]: ${result.result}`);
    return result;
  } catch (err) {
    console.error(`❌ Cloudinary delete error [${publicId}]:`, err.message);
    return null;
  }
};

module.exports = { cloudinary, deleteFromCloudinary };
