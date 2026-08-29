/**
 * Calculator Module
 * Fully functional calculator with standard operations.
 * Secret: entering 1314 and pressing = triggers the hidden app.
 */
const Calculator = (function () {
    let current = '0';
    let expression = '';
    let operator = null;
    let prevValue = null;
    let waitingForOperand = false;
    let justEvaluated = false;
    let onSecretTriggered = null;

    const exprEl = document.getElementById('calcExpr');
    const resultEl = document.getElementById('calcResult');
    const clearBtn = document.querySelector('[data-action="clear"]');

    function updateDisplay() {
        resultEl.textContent = current;
        exprEl.innerHTML = expression || '&nbsp;';
        // Toggle AC / C
        if (clearBtn) {
            clearBtn.textContent = (current === '0' && !operator) ? 'AC' : 'C';
        }
    }

    function inputNumber(val) {
        if (waitingForOperand || justEvaluated) {
            current = val;
            waitingForOperand = false;
            justEvaluated = false;
        } else {
            current = current === '0' ? val : current + val;
        }
        updateDisplay();
    }

    function inputDot() {
        if (waitingForOperand || justEvaluated) {
            current = '0.';
            waitingForOperand = false;
            justEvaluated = false;
        } else if (!current.includes('.')) {
            current += '.';
        }
        updateDisplay();
    }

    function inputOperator(op) {
        const value = parseFloat(current);
        const opSymbol = op;

        if (prevValue !== null && !waitingForOperand) {
            const result = calculate(prevValue, value, operator);
            if (result === 'Error') {
                current = 'Error';
                expression = '';
                prevValue = null;
                operator = null;
                updateDisplay();
                return;
            }
            current = formatNum(result);
            prevValue = result;
        } else {
            prevValue = value;
        }

        expression = current + ' ' + opSymbol;
        operator = op;
        waitingForOperand = true;
        justEvaluated = false;
        updateDisplay();
    }

    function calculate(a, b, op) {
        switch (op) {
            case '+': return a + b;
            case '−': return a - b;
            case '×': return a * b;
            case '÷': return b === 0 ? 'Error' : a / b;
            default: return b;
        }
    }

    function formatNum(n) {
        if (typeof n === 'string') return n;
        // Avoid floating point display issues
        const s = parseFloat(n.toPrecision(12)).toString();
        return s.length > 12 ? parseFloat(n).toExponential(6) : s;
    }

    function evaluate() {
        if (operator === null || prevValue === null) {
            // Check secret trigger
            if (current === '1314') {
                if (onSecretTriggered) onSecretTriggered();
                return;
            }
            return;
        }

        const value = parseFloat(current);
        const result = calculate(prevValue, value, operator);

        expression = prevValue + ' ' + operator + ' ' + value + ' =';

        if (result === 'Error') {
            current = 'Error';
        } else {
            current = formatNum(result);
        }

        // Check secret trigger on result
        if (current === '1314') {
            updateDisplay();
            if (onSecretTriggered) onSecretTriggered();
            return;
        }

        prevValue = null;
        operator = null;
        waitingForOperand = false;
        justEvaluated = true;
        updateDisplay();
    }

    function clearAll() {
        current = '0';
        expression = '';
        operator = null;
        prevValue = null;
        waitingForOperand = false;
        justEvaluated = false;
        updateDisplay();
    }

    function toggleSign() {
        if (current === '0' || current === 'Error') return;
        current = current.startsWith('-') ? current.slice(1) : '-' + current;
        updateDisplay();
    }

    function percent() {
        const value = parseFloat(current);
        if (isNaN(value)) return;
        current = formatNum(value / 100);
        updateDisplay();
    }

    function handleButton(btn) {
        const action = btn.dataset.action;
        switch (action) {
            case 'num': inputNumber(btn.dataset.val); break;
            case 'dot': inputDot(); break;
            case 'op': inputOperator(btn.dataset.op); break;
            case 'equals': evaluate(); break;
            case 'clear': clearAll(); break;
            case 'sign': toggleSign(); break;
            case 'percent': percent(); break;
        }
    }

    function init(callback) {
        onSecretTriggered = callback;
        updateDisplay();

        // Button clicks
        document.querySelectorAll('.calc-buttons .btn').forEach(btn => {
            btn.addEventListener('click', () => handleButton(btn));
        });

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            const calcView = document.getElementById('calc-view');
            if (!calcView.classList.contains('active')) return;

            if (e.key >= '0' && e.key <= '9') inputNumber(e.key);
            else if (e.key === '.') inputDot();
            else if (e.key === '+') inputOperator('+');
            else if (e.key === '-') inputOperator('−');
            else if (e.key === '*') inputOperator('×');
            else if (e.key === '/') { e.preventDefault(); inputOperator('÷'); }
            else if (e.key === 'Enter' || e.key === '=') evaluate();
            else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') clearAll();
            else if (e.key === '%') percent();
            else if (e.key === 'Backspace') {
                if (current.length > 1) current = current.slice(0, -1);
                else current = '0';
                updateDisplay();
            }
        });
    }

    function reset() {
        clearAll();
    }

    return { init, reset };
})();
