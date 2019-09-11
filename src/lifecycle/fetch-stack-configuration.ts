import { CloudFormation } from 'aws-sdk'

export const fetchStackConfiguration = async (
	StackName: string,
): Promise<{ [key: string]: string }> => {
	const cf = new CloudFormation({
		region: process.env.AWS_DEFAULT_REGION,
	})
	const { Stacks } = await cf.describeStacks({ StackName }).promise()
	if (!Stacks) {
		throw new Error(`Unknown stack "${StackName}"!`)
	}
	const Outputs = (Stacks && Stacks[0].Outputs) || []
	return Outputs.reduce(
		(outputs: any, { OutputKey, OutputValue }) => ({
			...outputs,
			[OutputKey as string]: OutputValue,
		}),
		{},
	)
}
