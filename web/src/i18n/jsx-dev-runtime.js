import { jsxDEV as reactJsxDEV } from "react/jsx-dev-runtime";
import { LocalizedHost, needsLocalization } from "./runtime";
export { Fragment } from "react/jsx-dev-runtime";

export const jsxDEV = (type, props, key, isStaticChildren, source, self) => {
  // Let React validate the original static children before localizing the host.
  const element = reactJsxDEV(type, props, key, isStaticChildren, source, self);
  return needsLocalization(type, props)
    ? reactJsxDEV(LocalizedHost, { tag: type, originalProps: element.props }, key, false, source, self) : element;
};
