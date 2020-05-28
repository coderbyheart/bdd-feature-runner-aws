import { FieldNode, getOperationAST, parse as gqlParse } from 'graphql'

export const parseQuery = (
	gqlQuery: string,
): {
	selection: string
	operation: string
} => {
	let selection = ''
	let operation = ''

	try {
		const op = getOperationAST(gqlParse(gqlQuery), undefined)
		operation = op?.name?.value ?? ''
		const selections = op?.selectionSet.selections
		selection =
			(Array.isArray(selections) &&
				selections.length > 0 &&
				(selections[0] as FieldNode).name.value) ||
			''
	} catch (error) {
		throw new TypeError(`Invalid GQL query: ${gqlQuery}: "${error.message}"`)
	}

	return {
		selection,
		operation,
	}
}
