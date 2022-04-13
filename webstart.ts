import {run} from './runner';


function webStart() {
  document.addEventListener("DOMContentLoaded", function() {
    var importObject = {
      imports: {
        print: (arg : any, mode: number) => {
          console.log("Inside print with mode = ", mode);
          if (mode == 0){
            console.log("Logging from WASM: None");
            arg = "None";
            throw new Error(`Invalid argument`);
          }
          else if (mode == 1){
            if (arg == 0){
              console.log("Logging from WASM: False");
              arg = "False";
            }
            else{
              console.log("Logging from WASM: True");
              arg = "True";
            }
          }
          else{
            console.log("Logging from WASM: ", arg);
          }
          // console.log("Logging from WASM: ", arg);
          const elt = document.createElement("pre");
          document.getElementById("output").appendChild(elt);
          elt.innerText = arg;
          return arg;
        },
        abs: (arg: number) => {return Math.abs(arg);},
        min: (arg1: number, arg2: number) => {return Math.min(arg1, arg2);},
        max: (arg1: number, arg2: number) => {return Math.max(arg1, arg2);},
        pow: (arg1: number, arg2: number) => {return Math.pow(arg1, arg2);},
      },
    };

    function renderResult(result : any) : void {
      if(result === undefined) { console.log("skip"); return; }
      const elt = document.createElement("pre");
      document.getElementById("output").appendChild(elt);
      elt.innerText = String(result);
    }

    function renderError(result : any) : void {
      const elt = document.createElement("pre");
      document.getElementById("output").appendChild(elt);
      elt.setAttribute("style", "color: red");
      elt.innerText = String(result);
    }

    document.getElementById("run").addEventListener("click", function(e) {
      const source = document.getElementById("user-code") as HTMLTextAreaElement;
      const output = document.getElementById("output").innerHTML = "";
      run(source.value, {importObject}).then((r) => { renderResult(r); console.log ("run finished") })
          .catch((e) => { renderError(e); console.log("run failed", e) });;
    });
  });
}

webStart();
