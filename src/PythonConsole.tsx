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

function PythonConsole({
    onMessage
} : PythonConsoleProps) : JSX.Element {

    const [history, setHistory] = useState<HistoryItem[]>(() => {
        const savedHistory = Cookies.get('pythonConsoleHistory');
        if (savedHistory) {
            console.log("savedHistory", savedHistory);
            const filteredHistory = JSON.parse(savedHistory).filter((h: any) => h.input !== "Python version");
            return filteredHistory;
        } else {
            return [];
        }
    });
    useEffect(() => {
        const savedHistory = Cookies.get('pythonConsoleHistory');
        console.log("savedHistory", savedHistory);
        if (savedHistory) {
            const filteredHistory = JSON.parse(savedHistory).filter((h: any) => h.input !== "Python version");
            setHistory(filteredHistory);
        }
    }, []);

    const N0Ref = useRef<number>(history.length); 
    const N0 = N0Ref.current; 
    const [historyIndex, setHistoryIndex] = useState<number>(-1);
    const [currentInput, setCurrentInput] = useState('');
    const [inputBuffer, setInputBuffer] = useState('');
    const [rows, setRows] = useState(1);
    const [isPyodideReady, setIsPyodideReady] = useState(false);
    // const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

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
            await micropip.install(['numpy', 'pandas', 'matplotlib']);
        `);
        onMessage("Packages loaded successfully");
    };

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js';
        script.async = true;
        script.onload = async () => {
            try {
                let pyodide = await (window as any).loadPyodide();
                (window as any).pyodide = pyodide;
                if (pyodide) {
                    onMessage("Pyodide loaded successfully");
                }
                await loadPyodidePackages();
                const result = await pyodide.runPythonAsync("import sys; sys.version");
                if (result !== undefined) {
                    setHistory(prev => [...prev, { input: "Python version", output: result.toString() }]);
                }
                if (pyodide) {
                    setIsPyodideReady(true);
                }
            } catch (error) {
                onMessage(`Error loading Pyodide or packages: ${error}`);
                setIsPyodideReady(false);
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
        // setInputBuffer(event.target.value);
        setCurrentInput(event.target.value);
    };
    const handleBlur = () => {
        setCurrentInput(inputBuffer);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.shiftKey && event.key === 'Enter') {
            event.preventDefault();
            setCurrentInput(prev => prev + '\n');
        } else {
            if (event.key === 'Tab') {
                event.preventDefault();
                setCurrentInput(prev => prependTabToLastLine(prev));
            } else if (event.key === 'Enter') {
                event.preventDefault();
                console.log("currentInput now before Enter: ", currentInput);
                executeCode(currentInput);
                setHistoryIndex(-1);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (historyIndex < history.length - 1) {
                    const newIndex = historyIndex + 1;
                    setHistoryIndex(newIndex);
                    setCurrentInput(history[history.length - 1 - newIndex].input);
                }
                console.log("historyIndex now after ArrowUp: ", historyIndex);
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
                console.log("historyIndex now after ArrowDown: ", historyIndex);
            }
        }
    };

    const executeCode = async (code: string) => {
        if (code.trim() === '') {
            return; // Handle empty inputs
        }
        const newHistoryItem: HistoryItem = { input: code, output: null };
        setHistory(prev => [...prev, newHistoryItem]);
        setCurrentInput('');
        if (!isPyodideReady) {
            onMessage("Pyodide is still loading. Please wait...");
            return;
        }
        try {
            const { pyodide } = window as any;
            const result = await pyodide.runPythonAsync(code);
            setHistory(prev => {
                const updated = [...prev];
                updated[updated.length - 1].output = result !== undefined ? result.toString() : null;
                return updated;
            });
        } catch (error) {
            setHistory(prev => {
                const updated = [...prev];
                updated[updated.length - 1].output = `${error}`;
                return updated;
            });
        }
    
        // if (inputRef.current) {
        //     inputRef.current.focus();
        // }
    };

    const toMultiline = (text: string) : string => {
        return text.split('\n').map((line, index) => (index===0 ? `${line}` : `... ${line}`)).join('\n');
    }
    const prependTabToLastLine = (text: string) : string => {
        const multilines = text.split('\n');
        return multilines.map((line, index) => (index=== multilines.length-1 ? `  ${line}` : line)).join('\n');
    }

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
                                <div>{`>>> ${toMultiline(item.input)}`}</div>
                                {item.output !== null && <div>{item.output}</div>}
                            </React.Fragment>)
                    } else {
                        return null;
                    }
                })}
                <div ref={scrollRef} />
            </div>)}
            <div className="python-console-input">
                <span>{'>>> '}</span>
                <textarea
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
