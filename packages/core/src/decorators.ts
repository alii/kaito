import "reflect-metadata";
import { MetadataKeys, Method, SchemaFunction } from "./types";

export const method = (method: Method) => (path: `/${string}` = "/"): MethodDecorator => (target, property) => {
  Reflect.defineMetadata(MetadataKeys.HTTP_METHOD, method, target, property);
  Reflect.defineMetadata(MetadataKeys.ROUTE_PATH, path, target, property);

  const existing = Reflect.getMetadata(MetadataKeys.AVAILABLE_ROUTE_METHODS, target) || [];

  Reflect.defineMetadata(MetadataKeys.AVAILABLE_ROUTE_METHODS, [...existing, property], target);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Schema = <T = any>(schema: SchemaFunction<T>): MethodDecorator => (target, property) => {
  Reflect.defineMetadata(MetadataKeys.SCHEMA, schema, target, property);
};

export const Controller = (path: `/${string}` = "/"): ClassDecorator => (target) => {
  if (!path.startsWith("/")) {
    throw new Error(`Path must start with / for ${target}`);
  }

  Reflect.defineMetadata(MetadataKeys.CONTROLLER_PATH, path, target);
};

export const Get = method("get");
export const Post = method("post");
export const Patch = method("patch");
export const Put = method("put");
export const Delete = method("delete");
