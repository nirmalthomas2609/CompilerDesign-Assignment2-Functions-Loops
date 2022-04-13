import * as mocha from 'mocha';
import {expect} from 'chai';
import { parser } from 'lezer-python';
import { traverseExpr, traverseStmt, traverse, parse } from '../parser';

// We write tests for each function in parser.ts here. Each function gets its 
// own describe statement. Each it statement represents a single test. You
// should write enough unit tests for each function until you are confident
// the parser works as expected. 
describe('traverseExpr(c, s) function', () => {
  it('parses a number in the beginning', () => {
    const source = "987";
    const cursor = parser.parse(source).cursor();

    // go to statement
    cursor.firstChild();
    // go to expression
    cursor.firstChild();

    const parsedExpr = traverseExpr(cursor, source);

    // Note: we have to use deep equality when comparing objects
    expect(parsedExpr).to.deep.equal({tag: "literal", value: {tag: "number", value: 987}});
  })
  it('parses an expression involving abs, min', () => {
    const source = "abs(min(1, b))";
    const cursor = parser.parse(source).cursor();

    // go to statement
    cursor.firstChild();
    // go to expression
    cursor.firstChild();

    const parsedExpr = traverseExpr(cursor, source);
    console.log("Parsed Expression");

    // TODO: add additional tests here to ensure traverseExpr works as expected
    expect(parsedExpr).to.deep.equal({tag: "builtin1", name: "abs", arg: {tag: "builtin2", name: "min", arg1: {tag: "num", value: 1}, arg2: {tag: "id", name: "b"}}});
  })
});

describe('parseVariableDefinition(c, s) function', () => {
  it('checks if it parses a variable definition correctly', () => {
    const source = "a: int = 2";
    const cursor = parser.parse(source).cursor();

    // go to statement
    cursor.firstChild();
    // go to expression
    cursor.firstChild();

    const parsedExpr = traverseExpr(cursor, source);

    // Note: we have to use deep equality when comparing objects
    expect(parsedExpr).to.deep.equal({tag: "int", name: "a", value: {tag: "number", value: 2}});
  })
});

describe('traverseStmt(c, s) function', () => {
  // TODO: add tests here to ensure traverseStmt works as expected
  it('parses a statement b = a', () => {
    const source = "b = a";
    const cursor = parser.parse(source).cursor();

    // go to statement
    cursor.firstChild();

    const parsedStmt = traverseStmt(cursor, source);

    // TODO: add additional tests here to ensure traverseExpr works as expected
    expect(parsedStmt).to.deep.equal({tag: "define", name: "b", value: {tag: "id", name: "a"}});
  })
});

describe('traverse(c, s) function', () => {
  // TODO: add tests here to ensure traverse works as expected
  it('Combination of parsing the statement and the expression from the first 2 test cases', () => {
    const source = "abs(min(1, b))\nb = a";
    const cursor = parser.parse(source).cursor();

    const parsed = traverse(cursor, source);

    // TODO: add additional tests here to ensure traverseExpr works as expected
    expect(parsed).to.deep.equal([{tag: "expr", expr: {tag: "builtin1", name: "abs", arg: {tag: "builtin2", name: "min", arg1: {tag: "num", value: 1}, arg2: {tag: "id", name: "b"}}}}, {tag: "define", name: "b", value: {tag: "id", name: "a"}}]);
  })
});

describe('parse(source) function', () => {
  it('parse a number', () => {
    const parsed = parse("987");
    expect(parsed).to.deep.equal([{tag: "expr", expr: {tag: "num", value: 987}}]);
  });  

  // TODO: add additional tests here to ensure parse works as expected
  it('Parsing the statement', () => {

    const parsed = parse("abs(min(1, b))\nb = a");

    // TODO: add additional tests here to ensure traverseExpr works as expected
    expect(parsed).to.deep.equal([{tag: "expr", expr: {tag: "builtin1", name: "abs", arg: {tag: "builtin2", name: "min", arg1: {tag: "num", value: 1}, arg2: {tag: "id", name: "b"}}}}, {tag: "define", name: "b", value: {tag: "id", name: "a"}}]);
  })
});