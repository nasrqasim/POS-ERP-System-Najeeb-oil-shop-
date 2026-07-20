import mongoose from 'mongoose';
const uri = "mongodb+srv://oilshop:Oil%233421@cluster0.68vjmln.mongodb.net/pos_system_db?retryWrites=true&w=majority";

async function main() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const custs = await db.collection('parties').find({ name: /hadid/i }).toArray();
    for (const c of custs) {
      console.log("Name:", JSON.stringify(c.name));
      console.log("Char codes:");
      for (let i = 0; i < c.name.length; i++) {
        console.log(`  char ${i}: ${c.name[i]} = ${c.name.charCodeAt(i)}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
}
main();
