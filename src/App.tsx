import './App.css';
import PythonConsole from './PythonConsole';

function App() {
    return (
        <div className="app">
            <main>
                <PythonConsole onMessage={(m: string)=>{console.log("PythonConsole:",m)}}/>
            </main>
        </div>
    );
}

export default App;
