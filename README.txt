1) Give three examples of Python programs that use binary operators and/or builtins from this PA, but have different behavior than your compiler. For each, write:
Answer: 
    a) pow = 1
      pow(pow, pow)

    In Python, when you run this piece of code, it returns an error which mentions that 'pow' is not callable. This is because once pow is assigned to an integer value, 
    it is no more considered to be a callable method. In our piece of code, because of the way the program is parsed, it compiles and runs while returning the value of 1 
    i.e, it interprets pow to be a method and and also an int depending on the location of the piece of code. 
    We could handle this by, checking the list of assignedVars when a function is called to see if the call name is part of the list of assignedVars in which case return
    the error as returned by python (In compile time)

    b) min(1, 2, 3)
    For our compiler, this will throw an error mentioning that the number of arguments to min method is incorrect. In Python, min/max handles multiple arguments to these 
    methods i.e min(1, 2, 3) returns 1.
    We could handle this by using a separate tag for methods which can accept a variable number of arguments, parse the same, evaluate each of the expression arguments and
    then call min/max recursively.

    c) a = print(1)
    In python2, print as a builtin method does not return any value and hence such a statement will result in an error. In Python3, print as a builtin method does not return
    any value but the above statement assigns a value of None to a.
    We can handle this in our compiler by using a separate tag for print instead of <expr>, which does not push anything to the stack and hence the expression evaluates to None
    and hence a is assigned to None. 

What resources did you find most helpful in completing the assignment?
Answer:
    Script which prints out the parsed tree. Watched the start of Yousef's tutorial. WASM documentation. Typescript documentation.

Who (if anyone) in the class did you work with on the assignment? (See collaboration below)
Answer:
    Venkat, Abhilash to discuss some of the areas where Python differs from our compiler. Also, discussed the edge cases for the compiler.