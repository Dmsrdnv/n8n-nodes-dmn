// Interface for parameter definitions from node properties
interface ParamDef {
	name: string;
	type: string; // e.g., 'string', 'number', 'boolean'
}

/**
 * Basic XML escaping helper
 */
const escapeXml = (unsafe: string): string => {
	return unsafe.replace(/[<>&'"]/g, (c) => {
		switch (c) {
			case '<': return '&lt;';
			case '>': return '&gt;';
			case '&': return '&amp;';
			case '\'': return '&apos;';
			case '"': return '&quot;';
			default: return c;
		}
	});
};

/**
 * Constructs a minimal DMN XML string from the rules grid and parameters.
 *
 * @export
 * @param {any[]} rulesGrid Array of rule objects
 * @param {ParamDef[]} inputParams List of input parameter definitions
 * @param {ParamDef[]} outputParams List of output parameter definitions
 * @param {string} hitPolicy Hit policy (e.g., 'UNIQUE', 'FIRST')
 * @returns {string} The generated DMN XML string
 */
export function constructDmnXml(rulesGrid: any[], inputParams: ParamDef[], outputParams: ParamDef[], hitPolicy: string): string {
	const decisionId = 'dynamicDecision'; // Fixed ID for the generated decision

	// Use parameter definitions including types, add "feel:" prefix
	const inputsXml = inputParams.map((param, index) =>
		`<input id="Input_${index + 1}" label="${escapeXml(param.name)}">
			<inputExpression id="InputExpression_${index + 1}" typeRef="feel:${escapeXml(param.type)}">
				<text>${escapeXml(param.name)}</text>
			</inputExpression>
		</input>`).join('\n');

	const outputsXml = outputParams.map((param, index) =>
		`<output id="Output_${index + 1}" label="${escapeXml(param.name)}" name="${escapeXml(param.name)}" typeRef="feel:${escapeXml(param.type)}">
			<outputValues><text></text></outputValues>
		</output>`).join('\n');

	const rulesXml = rulesGrid.map((rule, ruleIndex) => {
		// Input entries: Use '-' for null/undefined/empty string.
		const inputEntriesXml = inputParams.map((param, inputIndex) => {
			const value = rule[param.name];
			let textContent: string;

			if (value === null || value === undefined || String(value).trim() === '') {
				textContent = '-'; // Use hyphen for empty cells
			} else {
				const stringValue = String(value);
				const trimmedValue = stringValue.trim();

				if (param.type === 'string') {
					// Check if already quoted by user
					if ((trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) || (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))) {
						textContent = escapeXml(stringValue); // Pass explicitly quoted string as is
					} else {
						// Check for strong FEEL indicators (operators, brackets, comma, functions)
						const feelIndicatorsRegex = /[<>(),\[\]?*\/+\-]|^(?:not|date|time|duration)\(/i;
						if (feelIndicatorsRegex.test(trimmedValue)) {
							textContent = escapeXml(stringValue); // Assume FEEL expression/list, pass as is
						} else {
							// Assume simple literal, add quotes
							textContent = `"${escapeXml(stringValue)}"`;
						}
					}
				} else {
					// For non-string types (number, boolean), pass as is (escaped)
					textContent = escapeXml(stringValue);
				}
			}

			return `<inputEntry id="InputEntry_${ruleIndex + 1}_${inputIndex + 1}">
				<text>${textContent}</text>
			</inputEntry>`;
		}).join('\n');

		// Output entries: Add quotes for string types, similar to inputs.
		const outputEntriesXml = outputParams.map((param, outputIndex) => {
			const value = rule[param.name];
			let textContent: string;

			if (value === null || value === undefined) {
				// Represent null/undefined output explicitly if needed, or empty? DMN standard usually requires an expression.
				// Let's output an empty text for now, assuming the engine handles it or defaults based on type.
				// If null needs to be explicitly returned, use 'null'.
				textContent = 'null'; // Use 'null' literal for null/undefined output
			} else {
				const stringValue = String(value);
				const trimmedValue = stringValue.trim();

				if (param.type === 'string') {
					if ((trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) || (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))) {
						textContent = escapeXml(stringValue); // Pass explicitly quoted string as is
					} else {
						const feelIndicatorsRegex = /[<>(),\[\]?*\/+\-]|^(?:not|date|time|duration)\(/i;
						if (feelIndicatorsRegex.test(trimmedValue)) {
							textContent = escapeXml(stringValue); // Assume FEEL expression/list
						} else {
							textContent = `"${escapeXml(stringValue)}"`; // Assume simple literal
						}
					}
				} else {
					// Use raw value for numbers, booleans etc.
					textContent = escapeXml(stringValue);
				}
			}
			return `<outputEntry id="OutputEntry_${ruleIndex + 1}_${outputIndex + 1}">
				<text>${textContent}</text>
			</outputEntry>`;
		}).join('\n');

		return `<rule id="Rule_${ruleIndex + 1}">
			${inputEntriesXml}
			${outputEntriesXml}
		</rule>`;
	}).join('\n');

	// Construct the full DMN XML string
	const dmnXmlString = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/DMN/20151101/dmn.xsd"
             id="definitions_${decisionId}"
             name="Dynamic DMN"
             namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="${decisionId}" name="Dynamic Decision Table">
    <decisionTable id="decisionTable_${decisionId}" hitPolicy="${escapeXml(hitPolicy)}">
      ${inputsXml}
      ${outputsXml}
      ${rulesXml}
    </decisionTable>
  </decision>
</definitions>`;

	return dmnXmlString;
}
