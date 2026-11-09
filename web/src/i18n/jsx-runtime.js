import { jsx as reactJsx, jsxs as reactJsxs } from "react/jsx-runtime";
import { LocalizedHost, needsLocalization } from "./runtime";
export { Fragment } from "react/jsx-runtime";

export const jsx = (type, props, key) => {
  const element = reactJsx(type, props, key);
  return needsLocalization(type, props) ? reactJsx(LocalizedHost, { tag: type, originalProps: element.props }, key) : element;
};

export const jsxs = (type, props, key) => {
  const element = reactJsxs(type, props, key);
  return needsLocalization(type, props) ? reactJsx(LocalizedHost, { tag: type, originalProps: element.props }, key) : element;
};
