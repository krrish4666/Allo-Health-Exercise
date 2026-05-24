export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; issues?: unknown } };

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });
  const body = (await response.json()) as ApiResult<T>;

  if (!body.ok) {
    const error = new Error(body.error.message) as Error & { status: number; code: string };
    error.status = response.status;
    error.code = body.error.code;
    throw error;
  }

  return body.data;
}

export type ProductListItem = {
  id: string;
  name: string;
  sku: string;
  price: string;
  warehouses: Array<{
    stockId: string;
    warehouseId: string;
    warehouseName: string;
    location: string;
    totalUnits: number;
    reservedUnits: number;
    availableUnits: number;
  }>;
};

export type ReservationDetails = {
  id: string;
  stockId: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  createdAt: string;
  stock: {
    product: {
      id: string;
      name: string;
      sku: string;
      price: string;
    };
    warehouse: {
      id: string;
      name: string;
      location: string;
    };
  };
};
