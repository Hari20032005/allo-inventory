import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database…");

  // Warehouses
  const mumbai = await prisma.warehouse.upsert({
    where: { id: "wh-mumbai" },
    update: {},
    create: { id: "wh-mumbai", name: "Mumbai Central", location: "Mumbai, MH" },
  });
  const delhi = await prisma.warehouse.upsert({
    where: { id: "wh-delhi" },
    update: {},
    create: { id: "wh-delhi", name: "Delhi North", location: "Delhi, DL" },
  });
  const bangalore = await prisma.warehouse.upsert({
    where: { id: "wh-bangalore" },
    update: {},
    create: { id: "wh-bangalore", name: "Bangalore Tech Park", location: "Bangalore, KA" },
  });

  // Products
  const airpods = await prisma.product.upsert({
    where: { sku: "APPLE-AP3" },
    update: {},
    create: {
      id: "prod-airpods",
      sku: "APPLE-AP3",
      name: "Apple AirPods Pro (3rd Gen)",
      description: "Active noise cancellation, Adaptive Audio, USB-C charging.",
      price: 24900,
      imageUrl: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&q=80",
    },
  });

  const macbook = await prisma.product.upsert({
    where: { sku: "APPLE-MBP-M4" },
    update: {},
    create: {
      id: "prod-macbook",
      sku: "APPLE-MBP-M4",
      name: "MacBook Pro 14\" M4",
      description: "Apple M4 chip, 16GB RAM, 512GB SSD. Space Black.",
      price: 168900,
      imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80",
    },
  });

  const sony = await prisma.product.upsert({
    where: { sku: "SONY-WH1000XM5" },
    update: {},
    create: {
      id: "prod-sony",
      sku: "SONY-WH1000XM5",
      name: "Sony WH-1000XM5",
      description: "Industry-leading noise cancellation over-ear headphones.",
      price: 26990,
      imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
    },
  });

  // Stock — deliberately scarce to demo race conditions
  const stockData = [
    { productId: airpods.id, warehouseId: mumbai.id, totalQuantity: 3 },
    { productId: airpods.id, warehouseId: delhi.id, totalQuantity: 1 }, // only 1 left!
    { productId: macbook.id, warehouseId: mumbai.id, totalQuantity: 2 },
    { productId: macbook.id, warehouseId: bangalore.id, totalQuantity: 0 }, // out of stock
    { productId: sony.id, warehouseId: delhi.id, totalQuantity: 5 },
    { productId: sony.id, warehouseId: bangalore.id, totalQuantity: 1 }, // only 1 left!
  ];

  for (const s of stockData) {
    await prisma.stock.upsert({
      where: { productId_warehouseId: { productId: s.productId, warehouseId: s.warehouseId } },
      update: {},
      create: { ...s, reservedQuantity: 0 },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
