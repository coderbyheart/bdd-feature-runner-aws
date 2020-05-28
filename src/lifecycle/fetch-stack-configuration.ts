import { CloudFormation } from 'aws-sdk'

export const fetchStackConfiguration = async ({
	StackName,
	region,
}: {
	StackName: string
	region: string
}): Promise<{ [key: string]: string }> => {
	const cf = new CloudFormation({
		region,
	})
	const { Stacks } = await cf.describeStacks({ StackName }).promise()
	if (!Stacks) {
		throw new Error(`Unknown stack "${StackName}"!`)
	}
	const Outputs = Stacks[0]?.Outputs ?? []
	return Outputs.reduce(
		(outputs: any, { OutputKey, OutputValue }) => ({
			...outputs,
			[OutputKey as string]: OutputValue,
		}),
		{},
	)
}
