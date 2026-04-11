/**
 * AI Logic Theorem Solver UI Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    const engine = new window.LogicEngine();

    // Elements
    const premisesInput = document.getElementById('premises');
    const conclusionInput = document.getElementById('conclusion');
    const solveBtn = document.getElementById('solve-btn');
    const exampleBtn = document.getElementById('example-btn');
    const clearBtn = document.getElementById('clear-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const errorBox = document.getElementById('error-box');
    const errorText = document.getElementById('error-text');
    const resultSection = document.getElementById('result-section');
    const statusBadge = document.getElementById('status-badge');
    const resultTitle = document.getElementById('result-title');
    const cnfStepsContainer = document.getElementById('cnf-steps');
    const resolutionStepsContainer = document.getElementById('resolution-steps');
    const ttElement = document.getElementById('tt-element');
    const body = document.body;

    const symbolBtns = document.querySelectorAll('.symbol-btn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // State
    let lastFocusedInput = premisesInput;
    let exampleIdx = 0;

    // Examples
    const examples = [
        {
            premises: "P → Q\nP",
            conclusion: "Q",
            desc: "Modus Ponens"
        },
        {
            premises: "P → Q\n¬Q",
            conclusion: "¬P",
            desc: "Modus Tollens"
        },
        {
            premises: "P ∨ Q\n¬P",
            conclusion: "Q",
            desc: "Disjunctive Syllogism"
        },
        {
            premises: "R → S\nS → T",
            conclusion: "R → T",
            desc: "Hypothetical Syllogism"
        },
        {
            premises: "P ↔ Q",
            conclusion: "(P ∧ Q) ∨ (¬P ∧ ¬Q)",
            desc: "IFF Expansion"
        },
        {
            premises: "¬(P ∧ Q)",
            conclusion: "¬P ∨ ¬Q",
            desc: "De Morgan's Law"
        },
        {
            premises: "A → B\nB → C\nC → D",
            conclusion: "A → D",
            desc: "Transitive Chain"
        },
        {
            premises: "A ∧ (B ∨ C)",
            conclusion: "(A ∧ B) ∨ (A ∧ C)",
            desc: "Distribution Law"
        },
        {
            premises: "P → Q",
            conclusion: "¬Q → ¬P",
            desc: "Contrapositive"
        }
    ];

    // --- Tab Logic ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));
            
            btn.classList.add('active');
            document.getElementById(tabId).classList.remove('hidden');
        });
    });

    // --- Theme Logic ---
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        body.classList.add('light-theme');
        themeIcon.setAttribute('data-lucide', 'moon');
        lucide.createIcons();
    }

    themeToggle.addEventListener('click', () => {
        const isLight = body.classList.toggle('light-theme');
        const newTheme = isLight ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        themeIcon.setAttribute('data-lucide', isLight ? 'moon' : 'sun');
        lucide.createIcons();
    });

    // --- Symbol Keyboard Logic ---
    [premisesInput, conclusionInput].forEach(input => {
        input.addEventListener('focus', () => {
            lastFocusedInput = input;
        });
    });

    symbolBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const symbol = btn.getAttribute('data-symbol');
            const start = lastFocusedInput.selectionStart;
            const end = lastFocusedInput.selectionEnd;
            const text = lastFocusedInput.value;
            
            lastFocusedInput.value = text.substring(0, start) + symbol + text.substring(end);
            lastFocusedInput.focus();
            
            const newCursor = start + symbol.length;
            lastFocusedInput.setSelectionRange(newCursor, newCursor);
        });
    });

    // --- Core Actions ---
    function showError(msg) {
        if (!msg) {
            errorBox.classList.add('hidden');
            return;
        }
        errorText.textContent = msg;
        errorBox.classList.remove('hidden');
        lucide.createIcons();
    }

    solveBtn.addEventListener('click', () => {
        showError(null);
        const pLines = premisesInput.value.split('\n').filter(l => l.trim().length > 0);
        const conclusion = conclusionInput.value.trim();

        if (pLines.length === 0 || !conclusion) {
            showError("Please enter both premises and a conclusion.");
            return;
        }

        solveBtn.disabled = true;
        const originalText = solveBtn.innerHTML;
        solveBtn.innerHTML = '<i data-lucide="loader" class="animate-spin"></i> Processing...';
        lucide.createIcons();

        setTimeout(() => {
            try {
                solve(pLines, conclusion);
            } catch (err) {
                showError("Logic Error: " + err.message);
                resultSection.classList.add('hidden');
            } finally {
                solveBtn.disabled = false;
                solveBtn.innerHTML = originalText;
                lucide.createIcons();
            }
        }, 100);
    });

    exampleBtn.addEventListener('click', () => {
        const ex = examples[exampleIdx];
        premisesInput.value = ex.premises;
        conclusionInput.value = ex.conclusion;
        exampleIdx = (exampleIdx + 1) % examples.length;
        showError(null);
    });

    clearBtn.addEventListener('click', () => {
        premisesInput.value = '';
        conclusionInput.value = '';
        resultSection.classList.add('hidden');
        showError(null);
    });

    function solve(premises, conclusion) {
        resultSection.classList.remove('hidden');
        statusBadge.className = 'badge badge-processing';
        statusBadge.textContent = 'Analyzing...';
        resultTitle.textContent = 'Processing logical inference...';
        
        cnfStepsContainer.innerHTML = '';
        resolutionStepsContainer.innerHTML = '';
        ttElement.innerHTML = '';

        premises.forEach((p, idx) => {
            try {
                const node = engine.parse(p);
                engine.toCNF(node);
                renderCNFSteps(`Premise ${idx + 1}: ${p}`, engine.cnfSteps);
            } catch (e) {
                console.error(e);
            }
        });

        try {
            const negNode = engine.parse(`~(${conclusion})`);
            engine.toCNF(negNode);
            renderCNFSteps(`Negated Conclusion: ~(${conclusion})`, engine.cnfSteps);
        } catch (e) {
            console.error(e);
        }

        const { proved, resolutionSteps } = engine.resolve(premises, conclusion);
        
        if (proved) {
            statusBadge.className = 'badge badge-success';
            statusBadge.textContent = 'Proved';
            resultTitle.textContent = 'Theorem holds via contradiction (Resolution Success)';
        } else {
            statusBadge.className = 'badge badge-error';
            statusBadge.textContent = 'Not Proved';
            resultTitle.textContent = 'Resolution completed without contradiction';
        }

        if (resolutionSteps.length === 0) {
            resolutionStepsContainer.innerHTML = '<div class="step-item">No resolution steps possible or needed.</div>';
        } else {
            resolutionSteps.forEach(step => {
                const div = document.createElement('div');
                div.className = 'step-item';
                div.innerHTML = `
                    <span class="step-label">Resolved ${step.c1} and ${step.c2}</span>
                    <div class="step-content">Yields: ${step.res}</div>
                `;
                resolutionStepsContainer.appendChild(div);
            });
        }

        const tt = engine.generateTruthTable(premises, conclusion);
        renderTruthTable(tt);
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }

    function renderCNFSteps(title, steps) {
        const header = document.createElement('h4');
        header.textContent = title;
        header.style.marginTop = '1rem';
        header.style.marginBottom = '0.5rem';
        header.style.color = 'var(--text-main)';
        cnfStepsContainer.appendChild(header);

        steps.forEach(step => {
            const div = document.createElement('div');
            div.className = 'step-item';
            div.innerHTML = `
                <span class="step-label">${step.label}</span>
                <div class="step-content">${step.result}</div>
            `;
            cnfStepsContainer.appendChild(div);
        });
    }

    function renderTruthTable(tt) {
        let headRow = '<tr>';
        tt.variables.forEach(v => headRow += `<th>${v}</th>`);
        headRow += '<th>Premises Met</th>';
        headRow += '<th>Conclusion</th>';
        headRow += '</tr>';

        let bodyHtml = '';
        tt.rows.forEach(row => {
            let rowHtml = '<tr>';
            tt.variables.forEach(v => {
                const val = row.values[v];
                rowHtml += `<td class="${val}">${val ? 'T' : 'F'}</td>`;
            });
            rowHtml += `<td class="${row.valid}">${row.valid ? 'T' : 'F'}</td>`;
            rowHtml += `<td class="${row.conclusion}">${row.conclusion ? 'T' : 'F'}</td>`;
            rowHtml += '</tr>';
            bodyHtml += rowHtml;
        });

        ttElement.innerHTML = `<thead>${headRow}</thead><tbody>${bodyHtml}</tbody>`;
    }
});
