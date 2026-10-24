import mongoose, { Schema } from 'mongoose';
import type { User as UserType } from '@celebration-planner/shared';

const UserMongoSchema = new Schema<UserType>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  {
    timestamps: false,
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).passwordHash;
        delete (ret as Record<string, unknown>)._id;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).passwordHash;
        delete (ret as Record<string, unknown>)._id;
        return ret;
      },
    },
  }
);

export const UserModel: mongoose.Model<UserType> =
  (mongoose.models.User as mongoose.Model<UserType>) ||
  mongoose.model<UserType>('User', UserMongoSchema);
