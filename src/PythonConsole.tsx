/*
 * This file is part of `Simulation Workbench`.
 * 
 * `Simulation Workbench` is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * `Simulation Workbench` is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with `Simulation Workbench`.  If not, see <https://www.gnu.org/licenses/>.
 * 
 * Copyright (C) [2024] [Yunlong Lian]
*/

import React, { useEffect, useState, useRef } from 'react';
import { JSX } from 'react/jsx-runtime';
import Cookies from 'js-cookie';


interface PythonConsoleProps {
    onMessage: (message: string) => void;
}

interface HistoryItem {
    input: string;
    output: string | null;
}

//! examples of page element manipulators
// function changeElementText(id: string, text: string) {
//     const element = document.getElementById(id);
//     if (element) {
//         element.innerText = text;
//     }
// }

// function changeElementColor(id: string, color: any) {
//     const element = document.getElementById(id);
//     if (element) {
//         element.style.color = color;
//     }
// }
// class ElementManipulator {
//     private element: HTMLElement | null;

//     constructor(elementId: string) {
//         this.element = document.getElementById(elementId);
//     }

//     changeText(newText: string): void {
//         if (this.element) {
//             this.element.innerText = newText;
//         }
//     }

//     changeColor(newColor: string): void {
//         if (this.element) {
//             this.element.style.color = newColor;
//         }
//     }
// }

const packages = [
    'numpy', 'scipy', 'networkx',
    'sympy', 'ply', 'pyyaml',
    'pandas', 'matplotlib', 'plotly'
];

function PythonConsole({
    onMessage
} : PythonConsoleProps) : JSX.Element {

    const [history, setHistory] = useState<HistoryItem[]>(() => {
        const savedHistory = Cookies.get('pythonConsoleHistory');
        if (savedHistory) {
            return JSON.parse(savedHistory).filter((h: any) => h.input !== "Python version");
        } else {
            return [];
        }
    });
    useEffect(() => {
        const savedHistory = Cookies.get('pythonConsoleHistory');
        if (savedHistory) {
            const filteredHistory = JSON.parse(savedHistory).filter((h: any) => h.input !== "Python version");
            setHistory(_ => filteredHistory);
        }
    }, []);

    const N0Ref = useRef<number>(history.length); 
    const N0 = N0Ref.current; 
    const [historyIndex, setHistoryIndex] = useState<number>(-1);
    const [currentInput, setCurrentInput] = useState('');
    const [inputBuffer, setInputBuffer] = useState('');
    const [htmlInjection, setHtmlInjection] = useState<string|null>(null);
    const [pyodideStdOut, setpyodideStdOut] = useState<string|null>(null);
    const [pyodideStdErr, setpyodideStdErr] = useState<string|null>(null);
    const [rows, setRows] = useState(1);
    const [isPyodideReady, setIsPyodideReady] = useState<boolean>(false);
    const [isExecuting, setIsExecuting] = useState<boolean>(false);
    const [pendingOutput, setPendingOutput] = useState<string | null>(null);
    // const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const scrollToBottom = () => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        Cookies.set(
            'pythonConsoleHistory', JSON.stringify(history), 
            { expires: 30, sameSite: 'strict', secure: true }
        );
        scrollToBottom();
    }, [history]);

    const loadPyodidePackages = async () => {
        const { pyodide } = window as any;
        await pyodide.loadPackage("micropip");
        await pyodide.runPythonAsync(`
            import micropip
            await micropip.install([${packages.map(x=>`'${x}'`).join(', ')}]);
        `);
        await pyodide.runPythonAsync(`
            import js
        `);
        onMessage("Packages loaded successfully");
    };

    useEffect(() => {
        if (htmlInjection) {
            const iframe = document.getElementById('injected-plotly-html') as HTMLIFrameElement;
            // if (iframe && iframe.contentDocument) {
            //     iframe.contentDocument.open();
            //     iframe.contentDocument.write(htmlInjection);
            //     iframe.contentDocument.close();
            // }
            if (iframe) {
                iframe.srcdoc = htmlInjection;
            }
        }
    }, [htmlInjection]);
    
    useEffect(() => {
        if (!isExecuting && pendingOutput !== null) {
            setHistory(prev => [...prev, { input: '', output: pendingOutput } as HistoryItem]);
            setPendingOutput(null);
        }
    }, [isExecuting, pendingOutput]);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js';
        script.async = true;
        script.onload = async () => {
            try {
                setIsExecuting(true);
                let pyodide = await (window as any).loadPyodide({
                    stdout: (pyodideStdOut: string|null) => {
                        if (pyodideStdOut !== null) {
                            const strPyodideStdOut: string = "[Terminal]\n" + pyodideStdOut.toString();
                            if (strPyodideStdOut !== 'None') {
                                setPendingOutput(strPyodideStdOut);
                            }
                        }
                    },
                    stderr: (pyodideStdOut: string|null) => {
                        if (pyodideStdOut !== null) {
                            const strPyodideStdOut: string = "[Terminal]\n" + pyodideStdOut.toString();
                            if (strPyodideStdOut !== 'None') {
                                setPendingOutput(strPyodideStdOut);
                            }
                        }
                    }
                });
                (window as any).pyodide = pyodide;
                if (pyodide) {
                    onMessage("Pyodide loaded successfully");
                }
                await loadPyodidePackages();
                const result = await pyodide.runPythonAsync("import sys; sys.version");
                if (result !== undefined) {
                    const outs = result.toString();
                    const todoList = "\n\nTODO:\n\tinclude openai / llamaindex / langchain\n\tsupport ipython\n\trender iframes in-place";
                    setHistory(
                        prev => [...prev, { input: "Python version", output: outs + todoList }]
                    );
                }
                //! here is an entrance to element manipulation within terminal
                //! the host webpage can be manipulated by python code
                // pyodide.registerJsModule('mymodule', {
                //     changeElementText,
                //     changeElementColor
                // });
                //! Register the class with Pyodide
                // async function loadPyodideAndRegisterClass() {
                //     await loadPyodide();
                //     pyodide.registerJsModule('js', {
                //         ElementManipulator: window.ElementManipulator
                //     });
                // }
                if (pyodide) {
                    setIsPyodideReady(true);
                }
                setIsExecuting(false);
            } catch (error) {
                onMessage(`Error loading Pyodide or packages: ${error}`);
                setIsPyodideReady(false);
                setIsExecuting(false);
            }
        };
        document.head.appendChild(script);
        return () => {
            document.head.removeChild(script);
        };
    }, []);

    useEffect(() => {
        // Calculate the number of lines
        const numberOfLines = currentInput.split("\n").length;
        setRows(numberOfLines > 1 ? numberOfLines : 1);
    }, [currentInput]);

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const inputText = event.target.value;
        setCurrentInput(inputText);
    };
    const handleBlur = () => {
        setCurrentInput(inputBuffer);
    };

    const isContinueLastLine = (text: string): boolean => {
        const multilines = text.split('\n');
        return multilines[multilines.length-1].endsWith(':') || multilines[multilines.length-1].endsWith('\\');
    }

    const isMultiLine = (text: string): boolean => {
        const multilines = text.split('\n');
        return multilines.length > 1 && multilines[multilines.length-1] !== '';
    }

    const getSuggestions = async (objectName: string): Promise<string[]> => {
        if (!isPyodideReady) {
            onMessage("Pyodide is still loading. Please wait...");
            return [];
        }
        try {
            const { pyodide } = window as any;
            const code = `import json; json.dumps(dir(${objectName}))`;
            const result = await pyodide.runPythonAsync(code);
            return JSON.parse(result);
        } catch (error) {
            onMessage(`Error fetching suggestions: ${error}`);
            return [];
        }
    };

    const getObj = (text: string): {obj:string, x:string} => {
        const inputLines = text.split('\n');
        const lastLine = inputLines[inputLines.length - 1];
        const dotIndex = lastLine.lastIndexOf('.');
        return {
            obj: lastLine.substring(0, dotIndex), 
            x: lastLine.length-1===dotIndex ? '' : lastLine.substring(dotIndex+1)
        };
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.shiftKey && event.key === 'Enter') {
            event.preventDefault();
            setCurrentInput(prev => prev + '\n');
        } else if (event.key === 'Tab') {
            // event.preventDefault();
            // setCurrentInput(prev => prependTabToLastLine(prev));
            event.preventDefault();
            const { obj, x } = getObj(currentInput);
            getSuggestions(obj)
                .then(suggestions => {
                    setSuggestions(suggestions);
                    setShowSuggestions(true);
                    if (x !== '') {
                        // find keys in suggestions that starts with x
                        const matchingSuggestion = suggestions.find(suggestion => suggestion.startsWith(x));
                        if (matchingSuggestion) {
                            // then set the input box to obj.key
                            setCurrentInput(`${obj}.${matchingSuggestion}`);
                        }
                    }
                });
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (isContinueLastLine(currentInput) || isMultiLine(currentInput)) {
                setCurrentInput(prev => prev + '\n');
            } else {
                executeCode(currentInput);
                setHistoryIndex(-1);
            }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (historyIndex < history.length - 1) {
                const newIndex = historyIndex + 1;
                setHistoryIndex(newIndex);
                setCurrentInput(history[history.length - 1 - newIndex].input);
            }
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setCurrentInput(history[history.length - 1 - newIndex].input);
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setCurrentInput('');
            } 
        }
    };

    const isHtml = (s: string|null): boolean => {
        return s!==null && s.startsWith('<html>') && s.endsWith('</html>')
    }

    const isPythonError = (s: string|null): boolean => {
        return s!==null && s.startsWith('PythonError:')
    }

    const isPythonWarning = (s: string|null): boolean => {
        return s!==null && s.startsWith('PythonWarning:')
    };

    const isPyodideTerminal = (s: string|null): boolean => {
        return s!==null && s.startsWith('[Terminal]')
    };

    const getOutputColor = (s: string|null): string => {
        if (s === null) {
            return 'inherit';
        } else if (isPythonError(s)) {
            return '#ff00ff';
        } else if (isPythonWarning(s)) {
            return '#FFA500';
        } else if (isPyodideTerminal(s)) {
            return '#22ffff'
        } else {
            return 'inherit';
        }
    };

    const executeCode = async (code: string) => {
        if (code.trim() === '') {
            return; // Handle empty inputs
        }
        if (!isPyodideReady) {
            onMessage("Pyodide is still loading. Please wait...");
            return;
        }
        setIsExecuting(true);
        const { pyodide } = window as any;
            pyodide.runPythonAsync(code)
                .then((result: any) => {
                    let resultString: string|null = null;
                    let b = false;
                    if (result !== undefined && result !== null) {
                        resultString = result.toString();
                        b = isHtml(resultString);
                        if ( b ) {
                            setHtmlInjection(resultString);
                        }
                    }
                    setHistory(
                        prev => [...prev, {input: code, output: (b ? null : resultString)}]
                    );
                    setIsExecuting(false);
                    setCurrentInput('');
                })
                .catch((error:any) => {
                    setIsExecuting(false);
                    setHistory(
                        prev => [...prev, {input: code, output: `${error}`}]
                    );
                });
        // if (inputRef.current) {
        //     inputRef.current.focus();
        // }
    };

    const toMultiline = (text: string) : string => {
        return text.split('\n').map((line, index) => (index===0 ? `${line}` : `... ${line}`)).join('\n');
    };

    const prependTabToLastLine = (text: string) : string => {
        const multilines = text.split('\n');
        return multilines.map((line, index) => (index=== multilines.length-1 ? `  ${line}` : line)).join('\n');
    };

    return (
        <div className="python-console">
            {isPyodideReady && (<div className="python-console-history">
                {history.slice(N0).map((item, index: number) => {
                    if (index === 0) {
                        return (
                            <React.Fragment key={index}>
                                <div>{`${item.input} ${item.output}`}</div>
                            </React.Fragment>)
                    } else if (item.input !== 'Python version') {
                        return (
                            <React.Fragment key={index}>
                                {item.input!=='' && (<div>{`>>> ${toMultiline(item.input)}`}</div>)}
                                {item.output !== null && (
                                    <div style={{ color: getOutputColor(item.output) }}>
                                        {item.output}
                                    </div>
                                )}
                            </React.Fragment>
                        )
                    } else {
                        return null;
                    }
                })}
                <div ref={scrollRef} />
            </div>)}
            <div className="python-console-input">
                <span style={{ padding: '0', margin: '0' }}>{isPyodideReady ? (isExecuting ? '~~~' : '>>>') : 'loading...'}&nbsp;</span>
                <textarea
                    style={{ padding: '0', margin: '0' }}
                    // ref={inputRef}
                    value={currentInput}
                    onChange={handleInputChange}
                    //onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    rows={rows}
                />
            </div>
        </div>
    );
};

export default PythonConsole;
