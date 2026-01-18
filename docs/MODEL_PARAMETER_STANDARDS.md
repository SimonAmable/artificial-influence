# Model Parameter Standards

This document defines the standards and structure for model parameters in the `models` table. All parameters must follow these conventions to ensure consistency across the application.

## Table of Contents
- [Parameter Structure](#parameter-structure)
- [Required Fields](#required-fields)
- [Optional Fields](#optional-fields)
- [Data Types](#data-types)
- [UI Types](#ui-types)
- [Validation Rules](#validation-rules)
- [Naming Conventions](#naming-conventions)
- [Examples](#examples)

---

## Parameter Structure

All parameters are stored in the `parameters` JSONB column as an array of parameter definition objects:

```json
{
  "parameters": [
    {
      "name": "parameter_name",
      "type": "string|number|boolean",
      "label": "Display Label",
      "description": "Parameter description",
      "required": false,
      "default": "default_value",
      "ui_type": "select|text|number|slider|switch",
      // Type-specific optional fields below
    }
  ]
}
```

---

## Required Fields

Every parameter definition **MUST** include these fields:

### `name` (string)
- **Description**: The parameter identifier used in API calls
- **Format**: snake_case (e.g., `aspect_ratio`, `num_images`, `output_format`)
- **Rules**:
  - Must be unique within a model's parameter list
  - Use lowercase letters, numbers, and underscores only
  - Should match the API parameter name exactly (if applicable)
- **Example**: `"aspect_ratio"`, `"num_inference_steps"`

### `type` (string)
- **Description**: The data type of the parameter value
- **Allowed Values**: `"string"`, `"number"`, `"boolean"`
- **Example**: `"string"`, `"number"`, `"boolean"`

### `label` (string)
- **Description**: Human-readable label displayed in the UI
- **Format**: Title Case with proper capitalization
- **Example**: `"Aspect Ratio"`, `"Number of Images"`, `"Enable Safety Checker"`

### `description` (string, optional but recommended)
- **Description**: Detailed explanation of what the parameter does
- **Format**: Full sentence ending with period
- **Example**: `"Image aspect ratio for the output"`, `"Number of images to generate"`

### `ui_type` (string)
- **Description**: The UI component type to render for this parameter
- **Allowed Values**: `"select"`, `"text"`, `"number"`, `"slider"`, `"switch"`, `"textarea"`
- **Mapping Rules**: See [UI Types](#ui-types) section

---

## Optional Fields

### `required` (boolean)
- **Description**: Whether the parameter must be provided
- **Default**: `false` (if omitted)
- **Usage**: Set to `true` only if the API requires this parameter
- **Example**: `true`, `false`

### `default` (string | number | boolean | null)
- **Description**: Default value when parameter is not provided
- **Type**: Must match the `type` field
- **Rules**:
  - For `string` type: string value or `null`
  - For `number` type: number value or `null`
  - For `boolean` type: `true` or `false` (never `null`)
- **Example**: `"1:1"`, `1`, `true`, `null`

---

## Type-Specific Optional Fields

### String Parameters

#### `enum` (array of strings)
- **Description**: List of allowed values (mutually exclusive with `pattern`)
- **Usage**: Use when parameter has a fixed set of valid options
- **Example**: `["1:1", "16:9", "9:16"]`, `["jpg", "png", "webp"]`
- **Note**: If `enum` is provided, `ui_type` should typically be `"select"`

#### `pattern` (string)
- **Description**: Regular expression pattern for validation (mutually exclusive with `enum`)
- **Usage**: Use when parameter must match a specific format
- **Format**: Valid JavaScript/PostgreSQL regex pattern (escape backslashes in JSON: `\\d+`)
- **Example**: `"^\\d+:\\d+$"` (matches "16:9"), `"^\\d+x\\d+$"` (matches "1024x1024")
- **Note**: If `pattern` is provided, `ui_type` should typically be `"text"`

### Number Parameters

#### `min` (number)
- **Description**: Minimum allowed value (inclusive)
- **Example**: `0`, `1`, `512`

#### `max` (number)
- **Description**: Maximum allowed value (inclusive)
- **Example**: `100`, `2147483647`, `4096`

#### `step` (number)
- **Description**: Increment step for sliders (only used with `ui_type: "slider"`)
- **Default**: `1` (if omitted)
- **Example**: `0.1`, `1`, `10`

### Boolean Parameters
- **Note**: Boolean parameters have no type-specific optional fields
- **Default**: Should always be `true` or `false` (never `null`)

---

## Data Types

### `string`
- **Use Cases**:
  - Text inputs
  - Enumerated values (with `enum`)
  - Pattern-matched values (with `pattern`)
- **Default Value**: String literal or `null`
- **Examples**: `"1:1"`, `"1024x1024"`, `"auto"`, `null`

### `number`
- **Use Cases**:
  - Integer or decimal numeric values
  - Counts, sizes, seeds, steps
- **Default Value**: Number literal or `null`
- **Examples**: `1`, `30`, `3.5`, `-1`, `null`

### `boolean`
- **Use Cases**:
  - Toggle/switch parameters
  - Enable/disable flags
- **Default Value**: Must be `true` or `false` (never `null`)
- **Examples**: `true`, `false`

---

## UI Types

The `ui_type` field determines which UI component to render. Choose based on parameter characteristics:

### `"select"`
- **Use When**: Parameter has a fixed set of options (`enum` is defined)
- **Requirements**: Must have `enum` field
- **Example**: Aspect ratios, output formats, quality levels

### `"text"`
- **Use When**: 
  - Free-form text input
  - Pattern-validated input (`pattern` is defined)
  - No fixed options
- **Requirements**: May have `pattern` for validation

### `"number"`
- **Use When**: 
  - Integer or decimal input
  - No slider needed (discrete values or large ranges)
- **Requirements**: Should have `min` and/or `max` when applicable

### `"slider"`
- **Use When**: 
  - Numeric value with a reasonable range
  - User should see visual range selection
  - Continuous or fine-grained control needed
- **Requirements**: 
  - Must have `min` and `max`
  - Optional `step` for increment control
- **Example**: Quality (0-100), guidance scale (0-20)

### `"switch"`
- **Use When**: Boolean parameter (on/off toggle)
- **Requirements**: `type` must be `"boolean"`
- **Example**: Enable/disable flags, feature toggles

### `"textarea"`
- **Use When**: Multi-line text input (rare for parameters, typically used for prompts)
- **Note**: Not commonly used for model parameters

---

## Validation Rules

### General Rules
1. **Mutual Exclusivity**: 
   - `enum` and `pattern` cannot both be defined for the same parameter
   - Use `enum` for fixed options, `pattern` for format validation

2. **Type Consistency**:
   - `default` value type must match `type` field
   - Boolean defaults must be `true` or `false` (never `null`)

3. **UI Type Consistency**:
   - `select` requires `enum`
   - `slider` requires `min` and `max`
   - `switch` requires `type: "boolean"`

### String Validation
- If `enum` is provided, value must be one of the enum values
- If `pattern` is provided, value must match the regex pattern
- If neither is provided, any string is accepted (use with caution)

### Number Validation
- If `min` is provided, value must be >= `min`
- If `max` is provided, value must be <= `max`
- If both are provided, value must be in range `[min, max]`

### Boolean Validation
- Value must be exactly `true` or `false`
- No additional validation needed

---

## Naming Conventions

### Parameter Names (`name` field)
- **Format**: `snake_case`
- **Examples**: 
  - ✅ `aspect_ratio`, `num_images`, `output_format`
  - ❌ `aspectRatio`, `numImages`, `outputFormat` (camelCase)
  - ❌ `AspectRatio`, `NumImages` (PascalCase)

### Labels (`label` field)
- **Format**: Title Case with proper capitalization
- **Examples**:
  - ✅ `"Aspect Ratio"`, `"Number of Images"`, `"Output Format"`
  - ❌ `"aspect ratio"`, `"number of images"` (lowercase)
  - ❌ `"ASPECT RATIO"`, `"NUMBER OF IMAGES"` (uppercase)

### Descriptions (`description` field)
- **Format**: Full sentence, ending with period
- **Style**: Clear, concise, user-friendly
- **Examples**:
  - ✅ `"Image aspect ratio for the output"`
  - ✅ `"Number of images to generate"`
  - ❌ `"aspect ratio"` (too brief)
  - ❌ `"Image aspect ratio for the output"` (missing period)

---

## Examples

### Example 1: String Parameter with Enum (Select)
```json
{
  "name": "aspect_ratio",
  "type": "string",
  "label": "Aspect Ratio",
  "description": "Image aspect ratio for the output",
  "required": false,
  "default": "1:1",
  "enum": ["1:1", "16:9", "9:16", "4:3", "3:4"],
  "ui_type": "select"
}
```

### Example 2: String Parameter with Pattern (Text)
```json
{
  "name": "resolution",
  "type": "string",
  "label": "Resolution",
  "description": "Output resolution in format WIDTHxHEIGHT",
  "required": false,
  "default": "1024x1024",
  "pattern": "^\\d+x\\d+$",
  "ui_type": "text"
}
```

### Example 3: Number Parameter (Number Input)
```json
{
  "name": "num_images",
  "type": "number",
  "label": "Number of Images",
  "description": "Number of images to generate",
  "required": false,
  "default": 1,
  "min": 1,
  "max": 10,
  "ui_type": "number"
}
```

### Example 4: Number Parameter (Slider)
```json
{
  "name": "guidance",
  "type": "number",
  "label": "Guidance Scale",
  "description": "Strength of the guidance during generation",
  "required": false,
  "default": 3.5,
  "min": 0,
  "max": 20,
  "step": 0.1,
  "ui_type": "slider"
}
```

### Example 5: Boolean Parameter (Switch)
```json
{
  "name": "enhance_prompt",
  "type": "boolean",
  "label": "Enhance Prompt",
  "description": "Whether to apply prompt enhancement for improved quality",
  "required": false,
  "default": true,
  "ui_type": "switch"
}
```

### Example 6: Number Parameter with Null Default
```json
{
  "name": "seed",
  "type": "number",
  "label": "Seed",
  "description": "Random seed for reproducibility. Use -1 for random",
  "required": false,
  "default": -1,
  "min": -1,
  "max": 2147483647,
  "ui_type": "number"
}
```

---

## Checklist for Adding New Parameters

When adding a new parameter to a model, verify:

- [ ] `name` is in snake_case and matches API parameter name
- [ ] `type` is one of: `"string"`, `"number"`, `"boolean"`
- [ ] `label` is in Title Case
- [ ] `description` is a complete sentence ending with period
- [ ] `ui_type` matches the parameter characteristics
- [ ] `default` type matches `type` field
- [ ] For strings: either `enum` OR `pattern` is provided (not both)
- [ ] For numbers: `min` and/or `max` are provided when applicable
- [ ] For sliders: `min`, `max`, and optionally `step` are provided
- [ ] For booleans: `default` is `true` or `false` (never `null`)
- [ ] `required` is set appropriately (usually `false`)

---

## Common Parameter Patterns

### Aspect Ratio
```json
{
  "name": "aspect_ratio",
  "type": "string",
  "label": "Aspect Ratio",
  "description": "Image aspect ratio",
  "required": false,
  "default": "1:1",
  "enum": ["1:1", "16:9", "9:16", "4:3", "3:4"],
  "ui_type": "select"
}
```

### Output Format
```json
{
  "name": "output_format",
  "type": "string",
  "label": "Output Format",
  "description": "Image output format",
  "required": false,
  "default": "png",
  "enum": ["jpg", "png", "webp"],
  "ui_type": "select"
}
```

### Seed
```json
{
  "name": "seed",
  "type": "number",
  "label": "Seed",
  "description": "Random seed for reproducibility",
  "required": false,
  "default": null,
  "min": 0,
  "max": 2147483647,
  "ui_type": "number"
}
```

### Quality/Compression (Slider)
```json
{
  "name": "output_quality",
  "type": "number",
  "label": "Output Quality",
  "description": "Quality parameter (1-100) for lossy formats",
  "required": false,
  "default": 80,
  "min": 1,
  "max": 100,
  "ui_type": "slider"
}
```

---

## Migration Notes

When adding models via SQL migration:

1. **JSON Escaping**: Escape backslashes in regex patterns: `"^\\d+:\\d+$"`
2. **JSON Formatting**: Use single quotes for SQL strings, double quotes for JSON
3. **Null Values**: Use `null` (not `"null"`) for null defaults
4. **Boolean Defaults**: Use `true` or `false` (not `"true"` or `"false"`)
5. **Conflict Handling**: Always include `ON CONFLICT (identifier) DO NOTHING;`

Example SQL snippet:
```sql
'{
  "parameters": [
    {
      "name": "aspect_ratio",
      "type": "string",
      "label": "Aspect Ratio",
      "description": "Image aspect ratio",
      "required": false,
      "default": "1:1",
      "enum": ["1:1", "16:9"],
      "ui_type": "select"
    }
  ]
}'::jsonb
```

---

## Version History

- **v1.0** (2024): Initial standards document
  - Defined parameter structure
  - Established naming conventions
  - Documented UI type mappings
  - Added validation rules
