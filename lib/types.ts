export type WarehouseStock = {
  warehouseId: string;
  code: string;
  name: string;
  city: string;
  region: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
};

export type ProductWithStock = {
  id: string;
  sku: string;
  name: string;
  description: string;
  imageUrl: string;
  warehouses: WarehouseStock[];
};

export type ReservationView = {
  id: string;
  productId?: string;
  warehouseId?: string;
  quantity: number;
  status: "pending" | "confirmed" | "released";
  expiresAt: string;
  product: {
    sku: string;
    name: string;
    imageUrl: string;
  };
  warehouse: {
    code: string;
    name: string;
    city?: string;
    region?: string;
  };
};
