import mongoose, { Schema, model, models } from "mongoose";

const ItemSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    mainCategoryId: { type: Schema.Types.ObjectId, ref: "Category", required: false },
    subCategoryId: { type: Schema.Types.ObjectId, ref: "Category", required: false },
    unit: { type: String, enum: ["Liter", "KG", "Piece", "Carton"], default: "Liter" },
    litersInCtn: { type: Number, default: 0 },
    gallonsInCtn: { type: Number, default: 0 },
    purchaseRate: { type: Number, default: 0 },
    wholesaleRate: { type: Number, default: 0 },
    retailRate: { type: Number, default: 0 },
    stockQtyCartons: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Item = models.Item || model("Item", ItemSchema);
export default Item;
