import { z } from "zod";

export const CreateReservationSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().min(1),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const ReservationStatusSchema = z.enum(["PENDING", "CONFIRMED", "RELEASED"]);

export const ReservationSchema = z.object({
  id: z.string(),
  stockId: z.string(),
  quantity: z.number(),
  status: ReservationStatusSchema,
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  stock: z.object({
    productId: z.string(),
    warehouseId: z.string(),
    product: z.object({ name: z.string(), sku: z.string(), price: z.any() }),
    warehouse: z.object({ name: z.string(), location: z.string() }),
  }),
});
