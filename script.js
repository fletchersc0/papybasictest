document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let savedPaperIds = JSON.parse(localStorage.getItem('paperPinSavedIds')) || [];
    let builderPaperIds = []; // In-memory as per brief
    let allDemoPapers = []; // To store all generated demo papers
    let currentlyDisplayedExplorePapersCount = 0;
    const papersPerLoad = 20;
    let activeTab = 'explore'; // 'explore' or 'saved'

    let currentPaperForPassages = null; // ID of paper whose passages are shown
    let currentPassageForRelated = null; // Text of passage whose related papers are shown

    // --- DOM ELEMENTS ---
    const exploreTabButton = document.getElementById('exploreTabButton');
    const savedTabButton = document.getElementById('savedTabButton');
    const exploreView = document.getElementById('exploreView');
    const savedView = document.getElementById('savedView');

    // Explore View Columns
    const exploreFeedColumn = document.getElementById('exploreFeedColumn');
    const explorePassageColumn = document.getElementById('explorePassageColumn');
    const exploreRelatedColumn = document.getElementById('exploreRelatedColumn');

    // Saved View Columns
    const savedPapersColumn = document.getElementById('savedPapersColumn');
    const savedBuilderColumn = document.getElementById('savedBuilderColumn');
    const savedSuggestionsColumn = document.getElementById('savedSuggestionsColumn');

    // --- DEMO DATA GENERATION ---
    function generateDemoPaper(index) {
        const titles = ["The Future of AI", "Quantum Entanglement Explained", "Climate Change Solutions", "Exploring Mars", "Deep Sea Discoveries", "Ancient Civilizations", "The Human Brain", "Blockchain Technology", "Renewable Energy Sources", "Genetic Engineering Advances"];
        const authors = [
            ["Dr. Ada Lovelace", "Dr. Alan Turing"], ["Prof. Marie Curie", "Dr. Albert Einstein"], ["Dr. Isaac Newton"],
            ["Dr. Jane Goodall", "Prof. Stephen Hawking"], ["Dr. Galileo Galilei", "Dr. Nicolaus Copernicus"]
        ];
        const abstractSentences = [
            "This paper explores groundbreaking research in its respective field.",
            "We present a novel approach to understanding complex phenomena.",
            "Our findings suggest significant implications for future studies.",
            "Further investigation is required to fully validate these results.",
            "The methodology employed combines theoretical models with empirical data.",
            "A comprehensive review of existing literature is provided.",
            "This study contributes to the growing body of knowledge on this topic.",
            "We discuss the potential applications and limitations of our work."
        ];

        const title = titles[index % titles.length] + ` #${index + 1}`;
        const paperAuthors = authors[index % authors.length];
        // Create a 3-5 sentence abstract
        let abstract = "";
        const numSentences = 3 + (index % 3); // 3, 4, or 5 sentences
        for (let i = 0; i < numSentences; i++) {
            abstract += abstractSentences[(index + i) % abstractSentences.length] + " ";
        }

        return {
            id: `demo${index}`,
            title: title,
            authors: paperAuthors,
            abstract: abstract.trim(),
            // fullText: `Full text for ${title} would go here, potentially much longer. ` + abstract // For now, abstract is fine
        };
    }

    function initializeDemoPapers(count = 100) {
        allDemoPapers = [];
        for (let i = 0; i < count; i++) {
            allDemoPapers.push(generateDemoPaper(i));
        }
    }

    // --- RENDERING FUNCTIONS ---

    function createPaperCard(paper, context) {
        const card = document.createElement('article');
        card.className = 'card paper-card';
        card.dataset.paperId = paper.id;

        const titleEl = document.createElement('h4');
        titleEl.textContent = paper.title;
        card.appendChild(titleEl);

        const authorsEl = document.createElement('p');
        authorsEl.textContent = `Authors: ${paper.authors.join(', ')}`;
        card.appendChild(authorsEl);

        const abstractSnippet = paper.abstract.substring(0, 100) + (paper.abstract.length > 100 ? '...' : '');
        const abstractEl = document.createElement('p');
        abstractEl.textContent = abstractSnippet;
        card.appendChild(abstractEl);

        const actions = document.createElement('div');
        actions.className = 'actions';

        const isSaved = savedPaperIds.includes(paper.id);
        const saveButton = document.createElement('button');
        saveButton.className = 'save-toggle';
        saveButton.textContent = isSaved ? 'Saved' : 'Save';
        if (isSaved) saveButton.classList.add('saved');
        saveButton.onclick = () => toggleSavePaper(paper.id);
        actions.appendChild(saveButton);

        if (context === 'explore-feed' || context === 'explore-related' || context === 'saved-suggestions') {
            card.onclick = (e) => {
                if (e.target === saveButton) return; // Don't trigger if save button was clicked
                if (activeTab === 'explore') {
                     currentPaperForPassages = paper.id;
                     currentPassageForRelated = null; // Clear related when new paper is selected
                     refreshAll();
                }
                // No action on click for saved-suggestions or explore-related in this context
                // (Passage loading is only from explore-feed)
            };
        }


        if (context === 'saved-list') {
            card.classList.add('saved-paper-card');
            const addButton = document.createElement('button');
            addButton.className = 'add-to-builder';
            addButton.textContent = 'Add →';
            addButton.onclick = () => addPaperToBuilder(paper.id);
            actions.appendChild(addButton);
        }

        if (context === 'builder-list') {
            card.classList.add('builder-card');
            const upButton = document.createElement('button');
            upButton.className = 'reorder-up';
            upButton.textContent = '↑';
            upButton.onclick = () => moveBuilderItem(paper.id, -1);
            actions.appendChild(upButton);

            const downButton = document.createElement('button');
            downButton.className = 'reorder-down';
            downButton.textContent = '↓';
            downButton.onclick = () => moveBuilderItem(paper.id, 1);
            actions.appendChild(downButton);

            const removeButton = document.createElement('button');
            removeButton.className = 'remove-from-builder';
            removeButton.textContent = '×';
            removeButton.onclick = () => removePaperFromBuilder(paper.id);
            actions.appendChild(removeButton);
        }

        card.appendChild(actions);
        return card;
    }

    function renderExploreFeed() {
        exploreFeedColumn.innerHTML = '<h3>Explore Feed</h3>'; // Clear previous
        const papersToDisplay = allDemoPapers.slice(0, currentlyDisplayedExplorePapersCount);

        if (papersToDisplay.length === 0) {
            exploreFeedColumn.innerHTML += '<div class="placeholder">No papers to show.</div>';
            return;
        }
        papersToDisplay.forEach(paper => {
            exploreFeedColumn.appendChild(createPaperCard(paper, 'explore-feed'));
        });
        if (currentlyDisplayedExplorePapersCount < allDemoPapers.length) {
             exploreFeedColumn.innerHTML += '<div class="placeholder">Scroll to load more...</div>';
        } else {
            exploreFeedColumn.innerHTML += '<div class="placeholder">All papers loaded.</div>';
        }
    }

    function renderPassages() {
        explorePassageColumn.innerHTML = '<h3>Paper Passages</h3>';
        if (!currentPaperForPassages) {
            explorePassageColumn.innerHTML += '<div class="placeholder">Click a paper on the left to see its passages.</div>';
            return;
        }
        const paper = allDemoPapers.find(p => p.id === currentPaperForPassages) || savedPaperIds.map(id => allDemoPapers.find(p => p.id === id)).find(p => p && p.id === currentPaperForPassages); // Check demo or saved
        if (!paper) {
            explorePassageColumn.innerHTML += '<div class="placeholder">Paper not found.</div>';
            return;
        }

        // Simple sentence splitting. A more robust NLP library would be better.
        const sentences = paper.abstract.match(/[^.!?]+[.!?]+/g) || [paper.abstract];
        if (sentences.length === 0) {
            explorePassageColumn.innerHTML += '<div class="placeholder">No passages found in abstract.</div>';
            return;
        }

        sentences.forEach((sentence, index) => {
            const passageCard = document.createElement('article');
            passageCard.className = 'card passage-card';
            passageCard.dataset.passageId = `passage_${paper.id}_${index}`;
            passageCard.textContent = sentence.trim();
            passageCard.onclick = () => {
                currentPassageForRelated = sentence.trim();
                refreshAll();
            };
            explorePassageColumn.appendChild(passageCard);
        });
    }

    function renderRelatedPapers() {
        exploreRelatedColumn.innerHTML = '<h3>Related Papers</h3>';
        if (!currentPassageForRelated) {
            exploreRelatedColumn.innerHTML += '<div class="placeholder">Click a passage in the middle to see related papers.</div>';
            return;
        }

        // Simulate related papers: show 10 random demo papers (excluding current one if it's in demo)
        const related = [];
        const numRelated = 10;
        const availablePapers = allDemoPapers.filter(p => p.id !== currentPaperForPassages);

        for (let i = 0; i < numRelated && availablePapers.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availablePapers.length);
            related.push(availablePapers.splice(randomIndex, 1)[0]); // Add and remove to avoid duplicates
        }
        if (related.length === 0) {
             exploreRelatedColumn.innerHTML += '<div class="placeholder">No related papers found (demo).</div>';
             return;
        }
        related.forEach(paper => {
            exploreRelatedColumn.appendChild(createPaperCard(paper, 'explore-related'));
        });
    }

    function renderSavedPapersList() {
        savedPapersColumn.innerHTML = '<h3>Saved Papers</h3>';
        if (savedPaperIds.length === 0) {
            savedPapersColumn.innerHTML += '<div class="placeholder">No papers saved yet.</div>';
            return;
        }
        // Render in chronological order (reverse of how they were saved for "newest first")
        // Or, for now, just the order in savedPaperIds
        const savedPapers = savedPaperIds.map(id => allDemoPapers.find(p => p.id === id)).filter(p => p); // Get full paper objects

        savedPapers.forEach(paper => {
            savedPapersColumn.appendChild(createPaperCard(paper, 'saved-list'));
        });
    }

    function renderBuilderList() {
        savedBuilderColumn.innerHTML = '<h3>Builder</h3>';
        if (builderPaperIds.length === 0) {
            savedBuilderColumn.innerHTML += '<div class="placeholder">Add papers from your saved list to the builder.</div>';
            return;
        }
        const builderPapers = builderPaperIds.map(id => allDemoPapers.find(p => p.id === id)).filter(p => p);

        builderPapers.forEach(paper => {
            savedBuilderColumn.appendChild(createPaperCard(paper, 'builder-list'));
        });
        // Trigger suggestion refresh
        renderLiveSuggestions();
    }

    function renderLiveSuggestions() {
        savedSuggestionsColumn.innerHTML = '<h3>Live Suggestions</h3>';
        if (builderPaperIds.length === 0) {
            savedSuggestionsColumn.innerHTML += '<div class="placeholder">Suggestions will appear here based on your builder list.</div>';
            return;
        }
        // Simulate suggestions: show 5 random demo papers not in builder or already saved
        const suggestions = [];
        const numSuggestions = 5;
        const availablePapers = allDemoPapers.filter(p => !builderPaperIds.includes(p.id) && !savedPaperIds.includes(p.id));

        for (let i = 0; i < numSuggestions && availablePapers.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availablePapers.length);
            suggestions.push(availablePapers.splice(randomIndex, 1)[0]);
        }
         if (suggestions.length === 0) {
             savedSuggestionsColumn.innerHTML += '<div class="placeholder">No new suggestions found (demo).</div>';
             return;
        }
        suggestions.forEach(paper => {
            savedSuggestionsColumn.appendChild(createPaperCard(paper, 'saved-suggestions'));
        });
    }


    // --- STATE MUTATION & ACTIONS ---
    function toggleSavePaper(paperId) {
        const index = savedPaperIds.indexOf(paperId);
        if (index > -1) {
            savedPaperIds.splice(index, 1);
            // If un-saving, also remove from builder
            const builderIndex = builderPaperIds.indexOf(paperId);
            if (builderIndex > -1) {
                builderPaperIds.splice(builderIndex, 1);
            }
        } else {
            savedPaperIds.push(paperId);
        }
        localStorage.setItem('paperPinSavedIds', JSON.stringify(savedPaperIds));
        refreshAll();
    }

    function addPaperToBuilder(paperId) {
        if (!builderPaperIds.includes(paperId)) {
            builderPaperIds.push(paperId);
            refreshAll(); // This will call renderBuilderList which calls renderLiveSuggestions
        }
    }

    function removePaperFromBuilder(paperId) {
        const index = builderPaperIds.indexOf(paperId);
        if (index > -1) {
            builderPaperIds.splice(index, 1);
            refreshAll();
        }
    }

    function moveBuilderItem(paperId, direction) { // direction: -1 for up, 1 for down
        const index = builderPaperIds.indexOf(paperId);
        if (index === -1) return;

        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= builderPaperIds.length) return; // Out of bounds

        // Swap elements
        const temp = builderPaperIds[index];
        builderPaperIds[index] = builderPaperIds[newIndex];
        builderPaperIds[newIndex] = temp;
        refreshAll();
    }

    function loadMoreExplorePapers() {
        currentlyDisplayedExplorePapersCount = Math.min(allDemoPapers.length, currentlyDisplayedExplorePapersCount + papersPerLoad);
        renderExploreFeed(); // Only re-render the feed
    }

    // --- TAB SWITCHING ---
    function switchTab(tabName) {
        activeTab = tabName;
        if (tabName === 'explore') {
            exploreView.style.display = 'flex';
            savedView.style.display = 'none';
            exploreTabButton.classList.add('active');
            savedTabButton.classList.remove('active');
        } else { // 'saved'
            exploreView.style.display = 'none';
            savedView.style.display = 'flex';
            exploreTabButton.classList.remove('active');
            savedTabButton.classList.add('active');
        }
        // Reset selections when switching tabs to avoid confusion
        currentPaperForPassages = null;
        currentPassageForRelated = null;
        refreshAll();
    }

    // --- `refreshAll()` ---
    function refreshAll() {
        if (activeTab === 'explore') {
            renderExploreFeed();
            renderPassages();
            renderRelatedPapers();
        } else { // 'saved'
            renderSavedPapersList();
            renderBuilderList(); // This will also trigger renderLiveSuggestions
            // renderLiveSuggestions(); // Called by renderBuilderList
        }
    }

    // --- EVENT LISTENERS ---
    exploreTabButton.onclick = () => switchTab('explore');
    savedTabButton.onclick = () => switchTab('saved');

    // Infinite scroll for explore feed
    exploreFeedColumn.onscroll = () => {
        if (activeTab === 'explore') {
            // Check if scrolled to near bottom
            if (exploreFeedColumn.scrollTop + exploreFeedColumn.clientHeight >= exploreFeedColumn.scrollHeight - 100) {
                if (currentlyDisplayedExplorePapersCount < allDemoPapers.length) {
                    loadMoreExplorePapers();
                }
            }
        }
    };

    // --- INITIALIZATION ---
    initializeDemoPapers(100); // Generate 100 demo papers
    loadMoreExplorePapers();   // Load initial set for explore feed
    switchTab('explore');      // Set initial tab and render
});