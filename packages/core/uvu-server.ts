import { Kaito, Controller, Get, Post, Schema, KTX, KRT } from "./src";
import * as z from "zod";

const testingSchema = z.object({ name: z.string() });

@Controller("/test")
class Home {
  @Get("/get")
  async get(): KRT<{ success: boolean }> {
    return { body: { success: true } };
  }

  @Get("/:value")
  async param(ctx: KTX<{ params: { value: string } }>): KRT<{ hello: string }> {
    return { body: { hello: ctx.params.value } };
  }

  @Post("/post")
  @Schema(testingSchema)
  async post(ctx: KTX<typeof testingSchema>): KRT<{ name: string }> {
    return {
      body: ctx.body,
      status: 204,
      headers: {
        "X-Example": Date.now(),
      },
    };
  }
}

export const app = new Kaito({
  controllers: [new Home()],
  logging: true,
});
