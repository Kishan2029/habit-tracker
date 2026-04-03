import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import cloudinary from '../config/cloudinary.js';
import env from '../config/env.js';

class UserService {
  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  async updateProfile(userId, updates) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (updates.name !== undefined) {
      user.name = updates.name;
    }

    if (updates.settings) {
      if (updates.settings.theme !== undefined) {
        user.settings.theme = updates.settings.theme;
      }
      if (updates.settings.timezone !== undefined) {
        user.settings.timezone = updates.settings.timezone;
      }
      if (updates.settings.reminderTime !== undefined) {
        user.settings.reminderTime = updates.settings.reminderTime;
      }
      if (updates.settings.notifications) {
        const notifs = updates.settings.notifications;
        for (const [type, channels] of Object.entries(notifs)) {
          if (user.settings.notifications[type]) {
            if (channels.push !== undefined) {
              user.settings.notifications[type].push = channels.push;
            }
            if (channels.email !== undefined) {
              user.settings.notifications[type].email = channels.email;
            }
          }
        }
      }
    }

    await user.save();
    return user;
  }

  async uploadAvatar(userId, fileBuffer) {
    if (!cloudinary.config().cloud_name) {
      throw new AppError('Avatar upload is not configured on this server', 503);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Delete old avatar from Cloudinary if exists
    if (user.avatar?.publicId) {
      await cloudinary.uploader.destroy(user.avatar.publicId);
    }

    // Upload new avatar
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `habittracker_${env.nodeEnv}/avatars`,
          transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }],
        },
        (error, result) => {
          if (error) reject(new AppError('Avatar upload failed', 500));
          else resolve(result);
        }
      );
      stream.end(fileBuffer);
    });

    user.avatar = { url: result.secure_url, publicId: result.public_id };
    await user.save({ validateBeforeSave: false });

    return user;
  }
}

export default new UserService();
