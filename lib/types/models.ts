/**
 * TypeScript types for the models database schema
 */

/**
 * Model generation types
 */
export type ModelType = 'image' | 'video' | 'audio' | 'upscale';

/**
 * UI component types for parameter inputs
 */
export type ParameterUIType = 
  | 'text' 
  | 'number' 
  | 'select' 
  | 'switch' 
  | 'slider' 
  | 'textarea';

/**
 * Parameter data types
 */
export type ParameterDataType = 'string' | 'number' | 'boolean';

/**
 * Base parameter definition structure
 */
export interface BaseParameterDefinition {
  name: string;
  type: ParameterDataType;
  label: string;
  description?: string;
  required?: boolean;
  default?: string | number | boolean | null;
  ui_type: ParameterUIType;
}

/**
 * String parameter with enum or pattern validation
 */
export interface StringParameterDefinition extends BaseParameterDefinition {
  type: 'string';
  enum?: string[];
  pattern?: string; // Regex pattern for validation
}

/**
 * Number parameter with min/max constraints or discrete enum options
 */
export interface NumberParameterDefinition extends BaseParameterDefinition {
  type: 'number';
  min?: number;
  max?: number;
  step?: number; // For slider inputs
  /** When set, renders as select with these options instead of slider/number input */
  enum?: number[];
}

/**
 * Boolean parameter
 */
export interface BooleanParameterDefinition extends BaseParameterDefinition {
  type: 'boolean';
}

/**
 * Union type for all parameter definitions
 */
export type ParameterDefinition = 
  | StringParameterDefinition 
  | NumberParameterDefinition 
  | BooleanParameterDefinition;

/**
 * Model parameters structure stored in JSONB
 */
export interface ModelParameters {
  parameters: ParameterDefinition[];
}

/**
 * Database model record
 */
export interface Model {
  id: string;
  identifier: string;
  name: string;
  description: string | null;
  type: ModelType;
  provider: string | null;
  is_active: boolean;
  model_cost: number;
  parameters: ModelParameters;
  created_at: string;
  updated_at: string;
  /** Display columns - main UI info */
  aspect_ratios?: string[];
  default_aspect_ratio?: string;
  /** Image models: reference images for style/character. Video models: first frame / input image. */
  supports_reference_image?: boolean;
  /** Video models only: reference video for editing or motion copy (e.g. Grok Imagine Video, Kling motion). */
  supports_reference_video?: boolean;
  supports_first_frame?: boolean;
  supports_last_frame?: boolean;
  duration_options?: number[];
  max_images?: number;
}

/**
 * Model with parsed parameters (for easier access)
 */
export interface ModelWithParsedParameters extends Omit<Model, 'parameters'> {
  parameters: ParameterDefinition[];
}

/**
 * Input values for model generation (keyed by parameter name)
 */
export type ModelInputValues = Record<string, string | number | boolean | null>;

/**
 * Validated model input with type checking
 */
export interface ValidatedModelInput {
  modelId: string;
  values: ModelInputValues;
  errors?: Record<string, string>;
}

/**
 * Helper type for creating a new model
 */
export type CreateModelInput = Omit<Model, 'id' | 'created_at' | 'updated_at'>;

/**
 * Helper type for updating a model
 */
export type UpdateModelInput = Partial<Omit<Model, 'id' | 'created_at' | 'updated_at'>>;

/**
 * Type guard to check if parameter is a string parameter
 */
export function isStringParameter(
  param: ParameterDefinition
): param is StringParameterDefinition {
  return param.type === 'string';
}

/**
 * Type guard to check if parameter is a number parameter
 */
export function isNumberParameter(
  param: ParameterDefinition
): param is NumberParameterDefinition {
  return param.type === 'number';
}

/**
 * Type guard to check if parameter is a boolean parameter
 */
export function isBooleanParameter(
  param: ParameterDefinition
): param is BooleanParameterDefinition {
  return param.type === 'boolean';
}

/**
 * Validate a parameter value against its definition
 */
export function validateParameterValue(
  param: ParameterDefinition,
  value: unknown
): { valid: boolean; error?: string } {
  // Check required
  if (param.required && (value === null || value === undefined || value === '')) {
    return { valid: false, error: `${param.label} is required` };
  }

  // If not required and value is empty, it's valid
  if (!param.required && (value === null || value === undefined || value === '')) {
    return { valid: true };
  }

  // Type validation
  if (isStringParameter(param)) {
    if (typeof value !== 'string') {
      return { valid: false, error: `${param.label} must be a string` };
    }
    
    // Enum validation
    if (param.enum && !param.enum.includes(value)) {
      return { 
        valid: false, 
        error: `${param.label} must be one of: ${param.enum.join(', ')}` 
      };
    }
    
    // Pattern validation
    if (param.pattern) {
      const regex = new RegExp(param.pattern);
      if (!regex.test(value)) {
        return { valid: false, error: `${param.label} format is invalid` };
      }
    }
  } else if (isNumberParameter(param)) {
    if (typeof value !== 'number') {
      return { valid: false, error: `${param.label} must be a number` };
    }
    
    // Min/Max validation
    if (param.min !== undefined && value < param.min) {
      return { valid: false, error: `${param.label} must be at least ${param.min}` };
    }
    
    if (param.max !== undefined && value > param.max) {
      return { valid: false, error: `${param.label} must be at most ${param.max}` };
    }
  } else if (isBooleanParameter(param)) {
    if (typeof value !== 'boolean') {
      return { valid: false, error: `${param.label} must be a boolean` };
    }
  }

  return { valid: true };
}

/**
 * Get default value for a parameter
 */
export function getParameterDefault(param: ParameterDefinition): string | number | boolean | null {
  if (param.default !== undefined) {
    return param.default;
  }
  
  // Return type-appropriate default
  if (isStringParameter(param)) {
    return param.enum?.[0] || '';
  } else if (isNumberParameter(param)) {
    return param.min ?? 0;
  } else if (isBooleanParameter(param)) {
    return false;
  }
  
  return null;
}

/**
 * Parse model parameters from JSONB
 */
export function parseModelParameters(parameters: unknown): ParameterDefinition[] {
  if (!parameters || typeof parameters !== 'object') {
    return [];
  }
  
  const params = parameters as { parameters?: unknown[] };
  if (!Array.isArray(params.parameters)) {
    return [];
  }
  
  return params.parameters.filter((p): p is ParameterDefinition => {
    return (
      typeof p === 'object' &&
      p !== null &&
      'name' in p &&
      'type' in p &&
      'label' in p &&
      'ui_type' in p
    );
  });
}
