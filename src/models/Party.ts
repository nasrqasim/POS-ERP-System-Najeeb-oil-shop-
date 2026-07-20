import mongoose, { Schema, model, models } from "mongoose";

export interface IParty extends mongoose.Document {
  name: string;
  companyName?: string;
  contactPerson?: string;
  email?: string;
  code: string;
  type: "Customer" | "Vendor";
  address?: string;
  region?: string;
  area?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  mobile?: string;
  ntn?: string;
  strn?: string;
  gst?: string;
  balance: number;
  creditLimit: number;
  creditDays?: number;
  openingBalance: number;
  closingBalance?: number;
  debit: number;
  credit: number;
  manualDebit?: number;
  manualCredit?: number;
  category?: string;
  vendorType?: string;
  bankName?: string;
  accountNo?: string;
  branch?: string;
  paymentTerms?: number;
  whtApplicable?: boolean;
  status?: string;
  notes?: string;
}

const PartySchema = new Schema<IParty>(
  {
    name: { type: String, required: true },
    companyName: String,
    contactPerson: String,
    email: String,
    code: { type: String, required: true, unique: true },
    type: { type: String, enum: ["Customer", "Vendor"], required: true },
    address: String,
    region: String,
    area: String,
    postalCode: String,
    country: { type: String, default: "Pakistan" },
    phone: String,
    mobile: String,
    ntn: String,
    strn: String,
    gst: String,
    balance: { type: Number, default: 0 },
    creditLimit: { type: Number, default: 0 },
    creditDays: { type: Number, default: 30 },
    openingBalance: { type: Number, default: 0 },
    closingBalance: { type: Number, default: 0 },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    manualDebit: { type: Number, default: 0 },
    manualCredit: { type: Number, default: 0 },
    category: { type: String, default: "Cash Customer" },
    vendorType: String,
    bankName: String,
    accountNo: String,
    branch: String,
    paymentTerms: { type: Number, default: 30 },
    whtApplicable: { type: Boolean, default: false },
    status: { type: String, default: "Active" },
    notes: String,
  },
  { timestamps: true }
);

const Party = models.Party || model<IParty>("Party", PartySchema);

export default Party;
