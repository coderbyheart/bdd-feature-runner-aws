import { FieldNode, getOperationAST, parse as gqlParse } from 'graphql';

export const parseQuery = (gqlQuery: string) => {
  let selection = '';
  let operation = '';

  try {
    const op = getOperationAST(gqlParse(gqlQuery), undefined);
    operation = op && op.name ? op.name.value : '';
    selection =
      (op &&
        op.selectionSet.selections.length &&
        (<FieldNode>op.selectionSet.selections[0]).name.value) ||
      '';
  } catch (error) {
    throw new TypeError(`Invalid GQL query: ${gqlQuery}: "${error.message}"`);
  }

  return {
    selection,
    operation,
  };
};
