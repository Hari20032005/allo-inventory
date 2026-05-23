import type { Product, Warehouse, Stock, Reservation } from "@prisma/client";

export type ReservationWithRelations = Reservation & {
  stock: Stock & {
    product: Product;
    warehouse: Warehouse;
  };
};

export type ReservationResponse = {
  id: string;
  quantity: number;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  stock: {
    id: string;
    productId: string;
    warehouseId: string;
    product: {
      id: string;
      name: string;
      sku: string;
      price: number;
      description: string | null;
      imageUrl: string | null;
    };
    warehouse: {
      id: string;
      name: string;
      location: string;
    };
  };
};
