/* global __dirname */
const path = require("node:path");

// Apply the same display-only translation pattern throughout app screens and
// shared controls, while keeping NativeWind's JSX runtime and styling intact.
module.exports = function localizeMobile({ types: t }) {
  return {
    name: "opol-mobile-localization",
    visitor: {
      Program(program, state) {
        const filename = state.file.opts.filename || "";
        const mobileRoot = path.resolve(__dirname, "..");
        const relative = path.relative(mobileRoot, filename).replace(/\\/g, "/");
        if (!/^(app|components)\//.test(relative) || !/\.[jt]sx?$/.test(relative)) return;
        const imports = [];
        const textNames = new Set();
        for (const statement of program.get("body")) {
          if (!statement.isImportDeclaration() || statement.node.source.value !== "react-native") continue;
          statement.node.specifiers = statement.node.specifiers.filter((specifier) => {
            if (!t.isImportSpecifier(specifier) || !["Text", "TextInput"].includes(specifier.imported.name)) return true;
            if (/^(Raw|Untranslated)/.test(specifier.local.name)) return true;
            if (specifier.imported.name === "Text") textNames.add(specifier.local.name);
            imports.push(t.importSpecifier(t.identifier(specifier.local.name), t.identifier(specifier.imported.name)));
            return false;
          });
          if (!statement.node.specifiers.length) statement.remove();
        }
        if (!imports.length) return;
        let source = path.relative(path.dirname(filename), path.join(mobileRoot, "i18n/LocalizedText")).replace(/\\/g, "/");
        if (!source.startsWith(".")) source = `./${source}`;
        program.unshiftContainer("body", t.importDeclaration(imports, t.stringLiteral(source)));

        const recordField = /^(?:displayName|displayEmail|profileInitials|identity|userFullName|userEmail|fullName|firstName|lastName|ownerName|boatOwnerName|boatName|plateNumber|name|email|address|remarks)$|(?:_name|_email|_reference_no|_receipt_no|_plate_number)$/;
        const isRecord = (expression) => {
          if (t.isIdentifier(expression)) return recordField.test(expression.name);
          if (t.isMemberExpression(expression) || t.isOptionalMemberExpression(expression)) {
            const property = expression.property;
            return t.isIdentifier(property) && recordField.test(property.name);
          }
          if (t.isLogicalExpression(expression) || t.isConditionalExpression(expression)) {
            return isRecord(expression.left || expression.consequent) || isRecord(expression.right || expression.alternate);
          }
          return false;
        };
        program.traverse({
          JSXElement(element) {
            const opening = element.node.openingElement;
            if (!t.isJSXIdentifier(opening.name) || !textNames.has(opening.name.name)) return;
            const protect = element.node.children.some((child) => t.isJSXExpressionContainer(child) && isRecord(child.expression));
            if (protect && !opening.attributes.some((attribute) => t.isJSXAttribute(attribute) && attribute.name.name === "localize")) {
              opening.attributes.push(t.jsxAttribute(t.jsxIdentifier("localize"), t.jsxExpressionContainer(t.booleanLiteral(false))));
            }
          },
        });
      },
    },
  };
};
