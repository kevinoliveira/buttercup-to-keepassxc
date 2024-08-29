import { expect, test, mock, spyOn } from "bun:test";
import { getArguments } from "./helpers";
import * as util from 'util';


test("getArguments", () => {
    const spyParseArgs = spyOn(util,"parseArgs");

    // @ts-ignore
    spyParseArgs.mockImplementation(()=> ({ values: {} }) )
    expect(() => getArguments()).toThrow("missing arguments")

    // @ts-ignore
    spyParseArgs.mockImplementation(()=> ({ values: { input: "input1" } }) )
    expect(() => getArguments()).toThrow("missing arguments")

    // @ts-ignore
    spyParseArgs.mockImplementation(()=> ({ values: { input: "input1", output: "output1" } }) )
    expect(() => getArguments()).not.toThrow("missing arguments")
    expect(getArguments()).toStrictEqual({ input: "input1", output: "output1" })

    expect(spyParseArgs).toHaveBeenCalledTimes(4)
    expect(spyParseArgs).lastCalledWith({
        args: Bun.argv,
        options: { input: { type: 'string' }, output: { type: 'string' } },
        strict: true,
        allowPositionals: true,
    })

})



