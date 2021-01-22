import { MetadataKeys, Method } from "../types";
import { AnySchema } from "yup";
import { normalizePath } from "./url";

// eslint-disable-next-line @typescript-eslint/ban-types
export function readControllerMetadata(controller: object) {
  const base: `/${string}` = Reflect.getMetadata(MetadataKeys.CONTROLLER_PATH, controller.constructor);
  const classMethods: string[] = Reflect.getMetadata(MetadataKeys.AVAILABLE_ROUTE_METHODS, controller) || [];

  return {
    base,
    routes: classMethods.map((methodKey) => {
      const method: Method = Reflect.getMetadata(MetadataKeys.HTTP_METHOD, controller, methodKey);
      const schema: AnySchema | undefined = Reflect.getMetadata(MetadataKeys.SCHEMA, controller, methodKey);

      const routePath: string = Reflect.getMetadata(MetadataKeys.ROUTE_PATH, controller, methodKey);
      const path = normalizePath(base, routePath);

      return {
        methodName: methodKey as keyof typeof controller,
        path,
        routePath,
        schema,
        method,
      };
    }),
  };
}
