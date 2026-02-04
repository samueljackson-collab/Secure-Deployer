import { test, expect } from "@playwright/test";

test.describe("ML Model API", () => {
  test("GET /health returns healthy status", async ({ request }) => {
    const response = await request.get("/health");
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe("healthy");
  });

  test("POST /predict returns predictions for valid input", async ({
    request,
  }) => {
    const response = await request.post("/predict", {
      data: {
        features: [
          [5.1, 3.5, 1.4, 0.2],
          [6.2, 3.4, 5.4, 2.3],
        ],
      },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.predictions).toHaveLength(2);
    expect(body.model_version).toBeDefined();
    body.predictions.forEach((prediction: number) => {
      expect(prediction).toBeGreaterThanOrEqual(0);
      expect(prediction).toBeLessThanOrEqual(2);
    });
  });

  test("POST /predict returns error for empty features", async ({
    request,
  }) => {
    const response = await request.post("/predict", {
      data: {
        features: [],
      },
    });
    // The API may return 500 or 422 depending on model behavior with empty input
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
