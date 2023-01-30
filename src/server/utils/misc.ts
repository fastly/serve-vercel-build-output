export type PromiseOrValue<T> = Promise<T> | T;

export type Holder<T> = {
  item?: T
};
