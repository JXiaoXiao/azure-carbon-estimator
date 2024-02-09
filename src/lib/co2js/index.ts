import {co2} from '@tgwf/co2';
import {z} from 'zod';

import {ModelPluginInterface} from '../../interfaces';
import {KeyValuePair, ModelParams} from '../../types';

import {allDefined, validate} from '../../util/validations';
import {buildErrorMessage} from '../../util/helpers';
import {ERRORS} from '../../util/errors';

const {InputValidationError} = ERRORS;

export class Co2jsModel implements ModelPluginInterface {
  staticParams: KeyValuePair = {};
  model: any | undefined;

  errorBuilder = buildErrorMessage(this.constructor.name);

  /**
   * Configures the model with static parameters.
   */
  public async configure(staticParams: object): Promise<ModelPluginInterface> {
    this.setValidatedParams(staticParams);

    return this;
  }

  /**
   * Executes the model for a list of input parameters.
   */
  public async execute(inputs: ModelParams[]): Promise<ModelParams[]> {
    return inputs.map(input => {
      this.setValidatedParams(input);

      if (!input['bytes']) {
        throw new InputValidationError(
          this.errorBuilder({
            message: 'Bytes not provided',
          })
        );
      }

      const result = this.calculateResultByParams(input);

      if (result) {
        input['operational-carbon'] = result;
      }

      return input;
    });
  }

  /**
   * Calculates a result based on the provided static parameters type.
   */
  private calculateResultByParams(input: ModelParams) {
    const greenhosting = input['green-web-host'] === true;
    const options = input['options'];
    const bytes = input['bytes'];

    const paramType: {[key: string]: () => string} = {
      swd: () => {
        return options
          ? this.model.perVisitTrace(bytes, greenhosting, options).co2
          : this.model.perVisit(bytes, greenhosting);
      },
      '1byte': () => {
        return this.model.perByte(bytes, greenhosting);
      },
    };

    return paramType[this.staticParams.type]();
  }

  /**
   * Sets validated parameters for the class instance.
   */
  private setValidatedParams(params: object) {
    if ('type' in params) {
      const safeStaticParams = Object.assign(
        params,
        this.validateStaticParams(params)
      );

      this.staticParams.type = safeStaticParams.type;
      this.model = new co2({model: this.staticParams.type});
    }
  }

  /**
   * Validates static parameters.
   */
  private validateStaticParams(staticParams: object) {
    const schema = z
      .object({
        type: z.enum(['1byte', 'swd']),
      })
      .refine(allDefined);

    return validate<z.infer<typeof schema>>(schema, staticParams);
  }
}
