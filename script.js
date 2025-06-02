let graph;
let parent;
let selectedVertex = null; // Track selected vertex for modification or deletion
const classes = {};
const relations = [];
let isEditing = false; // To track if the modal is in "modify" mode
let editingClassName = null; // To store the class name being modified

// Initialize the graph on page load
function main() {
    const container = document.getElementById('graphContainer');
    if (!mxClient.isBrowserSupported()) {
        mxUtils.error('Browser not supported', 200, false);
    } else {
        graph = new mxGraph(container);
        parent = graph.getDefaultParent();
        graph.setConnectable(true);
        graph.setMultigraph(false);
        graph.connectionHandler.setCreateTarget(false);

        // Prevent invalid edges
        graph.connectionHandler.addListener(mxEvent.CONNECT, function(sender, evt) {
            const edge = evt.getProperty('cell');
            const source = edge.source;
            const target = edge.target;

            if (!source || !target || source === target) {
                graph.removeCells([edge]);
                alert('Invalid connection.');
            }
        });

        // Listen for click events to select an element
        graph.addListener(mxEvent.CLICK, function (sender, evt) {
            const cell = evt.getProperty('cell'); // The clicked element
            if (cell && cell.vertex) {
                selectedVertex = cell; // Set the selected class
                console.log('Selected vertex:', selectedVertex.value);
            } else if (cell && cell.edge) {
                selectedVertex = cell; // Set the selected relation
                console.log('Selected edge:', selectedVertex);
            } else {
                selectedVertex = null; // Reset if no valid element is clicked
                console.log('Nothing selected');
            }
        });
        
    }
}

function deleteSelectedClass() {
    if (selectedVertex) {
        const isVertex = selectedVertex.vertex; // Check if it's a vertex (class)
        const isEdge = selectedVertex.edge; // Check if it's an edge (relation)

        graph.getModel().beginUpdate();
        try {
            if (isVertex) {
                // Handle vertex (class) deletion
                graph.removeCells([selectedVertex]);
                const className = selectedVertex.value.split('\n')[0];
                delete classes[className];

                // Remove relations linked to the class
                relations = relations.filter(relation => {
                    const isRelated = relation.sourceClass === className || relation.targetClass === className;
                    if (isRelated) {
                        graph.removeCells([relation.edge]); // Remove from the graph
                    }
                    return !isRelated;
                });

                console.log(`Class ${className} and its relations deleted.`);
            } else if (isEdge) {
                // Handle edge (relation) deletion
                graph.removeCells([selectedVertex]);

                // Find and remove the relation from the `relations` array
                relations = relations.filter(relation => relation.edge !== selectedVertex);
                console.log('Deleted relation:', selectedVertex);
            }

            selectedVertex = null; // Reset the selection
        } finally {
            graph.getModel().endUpdate();
        }
    } else {
        alert('No class or relation selected.');
    }
}



// Show the context menu when right-clicking on an element
function showContextMenu(evt) {
    const contextMenu = document.getElementById('contextMenu');
    contextMenu.style.left = evt.clientX + 'px';
    contextMenu.style.top = evt.clientY + 'px';
    contextMenu.style.display = 'block';
}

// Hide the context menu
function hideContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    contextMenu.style.display = 'none';
}

// Open modal to add
function openAddClassModal() {
    const modal = new bootstrap.Modal(document.getElementById('addClassModal'));
    modal.show();
}
function openEditClassModal() {
    if (!selectedVertex || !selectedVertex.value) {
        alert("Veuillez sélectionner une classe à modifier.");
        return;
    }

    // Extract content from the selected vertex
    const content = selectedVertex.value.split("\n");
    const className = content[0] ? content[0].trim() : ""; // First line: Class name
    const attributes = content[2] ? content[2].trim() : ""; // Attributes after `--`
    const methods = content[4] ? content[4].trim() : ""; // Methods after second `--`

    // Convert visibility symbols to text
    const attributesText = attributes
        .split("\n")
        .map(line => convertSymbolToVisibility(line))
        .join("\n");

    const methodsText = methods
        .split("\n")
        .map(line => convertSymbolToVisibility(line))
        .join("\n");

    // Populate the edit modal fields
    document.getElementById("editClassName").value = className;
    document.getElementById("editClassAttributes").value = attributesText;
    document.getElementById("editClassMethods").value = methodsText;

    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById("editClassModal"));
    modal.show();
}


function saveModifiedClass() {
    if (!selectedVertex || !selectedVertex.vertex) {
        alert("Aucune classe sélectionnée pour modification.");
        return;
    }

    const className = document.getElementById("editClassName").value.trim();
    const attributesText = document.getElementById("editClassAttributes").value.trim();
    const methodsText = document.getElementById("editClassMethods").value.trim();

    if (!className) {
        alert("Le nom de la classe ne peut pas être vide.");
        return;
    }

    // Convert visibility text to symbols
    const attributes = attributesText
        .split("\n")
        .map(line => convertVisibilityToSymbol(line))
        .join("\n");

    const methods = methodsText
        .split("\n")
        .map(line => convertVisibilityToSymbol(line))
        .join("\n");

    // Update the graph and the `classes` object
    const content = `${className}\n--\n${attributes}\n--\n${methods}`;
    graph.getModel().beginUpdate();
    try {
        selectedVertex.value = content; // Update the vertex value
        graph.refresh(selectedVertex); // Refresh the graph

        // Update the class map
        const oldClassName = Object.keys(classes).find(key => classes[key].vertex === selectedVertex);
        if (oldClassName && oldClassName !== className) {
            delete classes[oldClassName];
        }
        classes[className] = { attributes: attributesText, methods: methodsText, vertex: selectedVertex };
    } finally {
        graph.getModel().endUpdate();
    }

    // Hide the modal
    bootstrap.Modal.getInstance(document.getElementById('editClassModal')).hide();
}



function convertSymbolToVisibility(line) {
    if (line.startsWith("+")) return line.replace("+", "public");
    if (line.startsWith("-")) return line.replace("-", "private");
    if (line.startsWith("#")) return line.replace("#", "protected");
    return line; // Return unchanged if no symbol is found
}

function convertVisibilityToSymbol(line) {
    if (line.startsWith("public")) return line.replace("public", "+");
    if (line.startsWith("private")) return line.replace("private", "-");
    if (line.startsWith("protected")) return line.replace("protected", "#");
    return line; // Return unchanged if no visibility is found
}

// Add a new class to the graph
function addClassFromModal() {
    const className = document.getElementById('className').value.trim();
    const attributes = document.getElementById('classAttributes').value.trim().split('\n');
    const methods = document.getElementById('classMethods').value.trim().split('\n');

    // Check if class already exists or is invalid
    if (!className || classes[className]) {
        alert('Class name is invalid or already exists.');
        return;
    }

    // Map the visibility, variable name, and type for attributes
    const attrContent = attributes.map(attr => {
        const [visibility, variableNameAndType] = attr.split(' ');
        const [variableName, type] = variableNameAndType ? variableNameAndType.split(':') : ['', ''];
        const visibilitySymbol = getVisibilitySymbol(visibility);
        if (visibilitySymbol && variableName && type) {
            return `${visibilitySymbol} ${variableName}:${type || ''}`;
        }
    }).join('\n');

    // Map the visibility, method name, parameters, and return type for methods
    const methodContent = methods.map(method => {
        // Skip empty methods (e.g., blank lines)
        if (!method.trim()) return '';

        const [visibility, methodNameAndParams] = method.split(' ');
        const [methodNameWithParams, returnType] = methodNameAndParams ? methodNameAndParams.split(':') : ['', ''];
        const paramsMatch = methodNameWithParams.match(/\((.*)\)/); // Extract parameters inside parentheses
        const methodName = methodNameWithParams.split('(')[0]; // Get method name
        const params = paramsMatch ? paramsMatch[1] : ''; // Get parameters inside parentheses

        const visibilitySymbol = getVisibilitySymbol(visibility);

        // Make sure methodName, params, and returnType exist
        if (visibilitySymbol && methodName && returnType) {
            return `${visibilitySymbol} ${methodName}(${params}): ${returnType}`;
        }
    }).filter(Boolean).join('\n'); // Remove empty methods

    const content = `${className}\n--\n${attrContent}\n--\n${methodContent}`;

    graph.getModel().beginUpdate();
    try {
        const vertex = graph.insertVertex(parent, null, content, 20, 20, 150, 120);
        classes[className] = { vertex, attributes, methods };
    } finally {
        graph.getModel().endUpdate();
    }

    // Hide the modal and reset the form
    bootstrap.Modal.getInstance(document.getElementById('addClassModal')).hide();
    document.getElementById('classForm').reset();
}



function openAssociationModal(type) {
    // Set the type of relation dynamically based on the button clicked
    document.getElementById('addAssociationModalLabel').innerText = `Ajouter Relation ${type} `;
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('addAssociationModal'));
    modal.show();
}

function openAggregationModal(type) {
    // Set the type of relation dynamically based on the button clicked
    document.getElementById('addAggregationModalLabel').innerText = `Ajouter Relation ${type} `;
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('addAggregationModal'));
    modal.show();
}

function openCompositionModal(type) {
    // Set the type of relation dynamically based on the button clicked
    document.getElementById('addCompositionModalLabel').innerText = `Ajouter Relation ${type}`;
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('addCompositionModal'));
    modal.show();
}

function openGeneralizationModal(type) {
    // Set the type of relation dynamically based on the button clicked
    document.getElementById('addGeneralizationModalLabel').innerText = `Ajouter Relation ${type} `;
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('addGeneralizationModal'));
    modal.show();
}


function addAssociation() {
    const sourceCardinality = document.getElementById('sourceCardinality').value.trim();
    const targetCardinality = document.getElementById('targetCardinality').value.trim();
    const sourceRole = document.getElementById('roleSource').value.trim();
    const targetRole = document.getElementById('roleTarget').value.trim();
    const sourceClass = document.getElementById('sourceClassAssociation').value.trim();
    const targetClass = document.getElementById('targetClassAssociation').value.trim();

    if (classes[sourceClass] && classes[targetClass]) {
        graph.getModel().beginUpdate();
        try {
            const label = `${sourceRole} ${sourceCardinality} - ${targetCardinality} ${targetRole}`;
            graph.insertEdge(parent, null, label, classes[sourceClass].vertex, classes[targetClass].vertex);

            // Define type explicitly
            const type = "Association";
            relations.push({ type, sourceCardinality, targetCardinality, sourceRole, targetRole, sourceClass, targetClass });
        } finally {
            graph.getModel().endUpdate();
        }

        // Hide modal and reset form
        const modal = bootstrap.Modal.getInstance(document.getElementById('addAssociationModal'));
        modal.hide();
        document.getElementById('associationForm').reset();
    } else {
        alert('One or both classes do not exist.');
    }
}

function addAggregation() {
    const sourceClass = document.getElementById('sourceClassAggregation').value.trim();
    const targetClass = document.getElementById('targetClassAggregation').value.trim();

    if (classes[sourceClass] && classes[targetClass]) {
        graph.getModel().beginUpdate();
        try {
            const label = `${sourceClass} aggregates ${targetClass}`;
            graph.insertEdge(parent, null, label, classes[sourceClass].vertex, classes[targetClass].vertex);

            // Define type explicitly
            const type = "Aggregation";
            relations.push({ type, sourceClass, targetClass });
        } finally {
            graph.getModel().endUpdate();
        }

        // Hide modal and reset form
        const modal = bootstrap.Modal.getInstance(document.getElementById('addAggregationModal'));
        modal.hide();
        document.getElementById('aggregationForm').reset();
    } else {
        alert('One or both classes do not exist.');
    }
}

function addComposition() {
    const sourceClass = document.getElementById('sourceClassComposition').value.trim();
    const targetClass = document.getElementById('targetClassComposition').value.trim();

    if (classes[sourceClass] && classes[targetClass]) {
        graph.getModel().beginUpdate();
        try {
            const label = `${sourceClass} contains ${targetClass}`;
            graph.insertEdge(parent, null, label, classes[sourceClass].vertex, classes[targetClass].vertex);

            // Define type explicitly
            const type = "Composition";
            relations.push({ type, sourceClass, targetClass });
        } finally {
            graph.getModel().endUpdate();
        }

        // Hide modal and reset form
        const modal = bootstrap.Modal.getInstance(document.getElementById('addCompositionModal'));
        modal.hide();
        document.getElementById('compositionForm').reset(); // Reset the form
    } else {
        alert('One or both classes do not exist.');
    }
}


function addGeneralization() {
    // Get class names from the modal inputs
    const sourceClass = document.getElementById('sourceClassGeneralization').value.trim();
    const targetClass = document.getElementById('targetClassGeneralization').value.trim();

    // Check if both classes exist
    if (classes[sourceClass] && classes[targetClass]) {
        graph.getModel().beginUpdate();
        try {
            // Add edge with descriptive label
            const label = `${sourceClass} inherits ${targetClass}`;
            graph.insertEdge(parent, null, label, classes[sourceClass].vertex, classes[targetClass].vertex);

            // Push the relation into the relations array
            relations.push({
                type: 'Generalization',
                sourceClass,
                targetClass
            });
        } finally {
            graph.getModel().endUpdate();
        }

        // Hide the modal after adding the relation
        const modal = bootstrap.Modal.getInstance(document.getElementById('addGeneralizationModal'));
        modal.hide();

        // Reset the form
        document.getElementById('generalizationForm').reset();
    } else {
        alert('One or both classes do not exist. Please ensure valid class names.');
    }
}





// Generate Java code based on the UML diagram
function generateJavaCode() {
    const code = [];

    // Map of classes and their parent (if they extend another class)
    const parentClasses = {};
    const associations = [];
    const aggregations = [];
    const compositions = [];

    // Separate relations by type
    relations.forEach(relation => {
        if (relation.type === 'Generalization') {
            parentClasses[relation.sourceClass] = relation.targetClass;
        } else if (relation.type === 'Association') {
            associations.push(relation);
        } else if (relation.type === 'Aggregation') {
            aggregations.push(relation);
        } else if (relation.type === 'Composition') {
            compositions.push(relation);
        }
    });

    // Generate class definitions
    for (const [className, classData] of Object.entries(classes)) {
        // Check if this class extends another class
        const extendsClause = parentClasses[className] ? ` extends ${parentClasses[className]}` : '';
        code.push(`class ${className}${extendsClause} {`);

        // Attributes
        classData.attributes.forEach(attr => {
            const [visibility, variableNameAndType] = attr.split(' ');
            const [variableName, type] = variableNameAndType ? variableNameAndType.split(':') : ['', ''];
            if (visibility && variableName && type) {
                code.push(`    ${visibility} ${type} ${variableName};`);
            }
        });

        // Add associations
        associations
            .filter(assoc => assoc.sourceClass === className)
            .forEach(assoc => {
                code.push(`    ${assoc.targetClass} ${assoc.targetRole}; // Association`);
            });

        // Add aggregations
        aggregations
            .filter(agg => agg.sourceClass === className)
            .forEach(agg => {
                code.push(`    List<${agg.targetClass}> ${agg.targetClass.toLowerCase()}s; // Aggregation`);
            });

        // Add compositions
        compositions
            .filter(comp => comp.sourceClass === className)
            .forEach(comp => {
                code.push(`    private ${comp.targetClass} ${comp.targetClass.toLowerCase()}; // Composition`);
            });

        // Methods
classData.methods.forEach(method => {
    const [visibility, methodNameAndParams] = method.split(' ');
    const [methodNameWithParams, returnType] = methodNameAndParams ? methodNameAndParams.split(':') : ['', ''];
    const methodName = methodNameWithParams.split('(')[0]; // Extract method name before '('
    const params = methodNameWithParams.includes('(') ? methodNameWithParams.split('(')[1].replace(')', '') : ''; // Safely extract params

    if (visibility && methodName) {
        // Add empty body {} and ; at the end
        code.push(`    ${visibility} ${returnType || 'void'} ${methodName}(${params}) {};`);
    }
});



        code.push('}');
    }

    document.getElementById('output').textContent = code.join('\n');
}

//php 
function generatePhpCode() {
    const code = [];

    // Map of classes and their parent (if they extend another class)
    const parentClasses = {};
    const associations = [];
    const aggregations = [];
    const compositions = [];

    // Separate relations by type
    relations.forEach(relation => {
        if (relation.type === 'Generalization') {
            parentClasses[relation.sourceClass] = relation.targetClass;
        } else if (relation.type === 'Association') {
            associations.push(relation);
        } else if (relation.type === 'Aggregation') {
            aggregations.push(relation);
        } else if (relation.type === 'Composition') {
            compositions.push(relation);
        }
    });

    // Generate class definitions
    for (const [className, classData] of Object.entries(classes)) {
        // Check if this class extends another class
        const extendsClause = parentClasses[className] ? ` extends ${parentClasses[className]}` : '';
        code.push(`class ${className}${extendsClause} {`);

        // Attributes
        classData.attributes.forEach(attr => {
            const [visibility, variableNameAndType] = attr.split(' ');
            const [variableName, type] = variableNameAndType ? variableNameAndType.split(':') : ['', ''];
            if (visibility && variableName) {
                code.push(`    ${visibility} $${variableName};`);
            }
        });

        // Add associations
        associations
            .filter(assoc => assoc.sourceClass === className)
            .forEach(assoc => {
                code.push(`    public $${assoc.targetRole}; // Association`);
            });

        // Add aggregations
        aggregations
            .filter(agg => agg.sourceClass === className)
            .forEach(agg => {
                code.push(`    public array $${agg.targetClass.toLowerCase()}s; // Aggregation`);
            });

        // Add compositions
        compositions
            .filter(comp => comp.sourceClass === className)
            .forEach(comp => {
                code.push(`    private ${comp.targetClass} $${comp.targetClass.toLowerCase()}; // Composition`);
            });

        // Methods
classData.methods.forEach(method => {
    const [visibility, methodNameAndParams] = method.split(' ');
    const [methodNameWithParams, returnType] = methodNameAndParams ? methodNameAndParams.split(':') : ['', ''];
    const methodName = methodNameWithParams.split('(')[0]; // Extract method name before '('
    const params = methodNameWithParams.includes('(') ? methodNameWithParams.split('(')[1].replace(')', '') : ''; // Safely extract params

    if (visibility && methodName) {
        // Add empty body {} and ; at the end
        code.push(`    ${visibility} function ${methodName}(${params}): ${returnType || 'void'} {};`);
    }
});



        code.push('}');
    }

    document.getElementById('output').textContent = code.join('\n');
}

//python
function generatePythonCode() {
    const code = [];

    // Map of classes and their parent (if they extend another class)
    const parentClasses = {};
    const associations = [];
    const aggregations = [];
    const compositions = [];

    // Separate relations by type
    relations.forEach(relation => {
        if (relation.type === 'Generalization') {
            parentClasses[relation.sourceClass] = relation.targetClass;
        } else if (relation.type === 'Association') {
            associations.push(relation);
        } else if (relation.type === 'Aggregation') {
            aggregations.push(relation);
        } else if (relation.type === 'Composition') {
            compositions.push(relation);
        }
    });

    // Generate class definitions
    for (const [className, classData] of Object.entries(classes)) {
        // Check if this class extends another class
        const parentClass = parentClasses[className] ? `(${parentClasses[className]})` : '';
        code.push(`class ${className}${parentClass}:`);

        // Constructor for attributes
        const attributes = classData.attributes.map(attr => {
            const [_, variableNameAndType] = attr.split(' ');
            const [variableName] = variableNameAndType ? variableNameAndType.split(':') : ['', ''];
            return variableName ? `self.${variableName} = None` : null;
        }).filter(Boolean);

        // Add associations to constructor
        const assocInit = associations
            .filter(assoc => assoc.sourceClass === className)
            .map(assoc => `self.${assoc.targetRole} = None  # Association`);

        // Add aggregations to constructor
        const aggInit = aggregations
            .filter(agg => agg.sourceClass === className)
            .map(agg => `self.${agg.targetClass.toLowerCase()}s = []  # Aggregation`);

        // Add compositions to constructor
        const compInit = compositions
            .filter(comp => comp.sourceClass === className)
            .map(comp => `self.${comp.targetClass.toLowerCase()} = ${comp.targetClass}()  # Composition`);

        if (attributes.length > 0 || assocInit.length > 0 || aggInit.length > 0 || compInit.length > 0) {
            code.push('    def __init__(self):');
            [...attributes, ...assocInit, ...aggInit, ...compInit].forEach(line => code.push(`        ${line}`));
        } else {
            code.push('    pass');
        }

        // Methods
classData.methods.forEach(method => {
    const [_, methodNameAndParams] = method.split(' ');
    const [methodNameWithParams, returnType] = methodNameAndParams ? methodNameAndParams.split(':') : ['', ''];
    const methodName = methodNameWithParams.split('(')[0]; // Extract method name before '('
    const params = methodNameWithParams.includes('(') ? methodNameWithParams.split('(')[1].replace(')', '') : ''; // Safely extract params

    if (methodName) {
        // Add a pass statement inside the function body
        code.push(`    def ${methodName}(self${params ? `, ${params}` : ''}) -> ${returnType || 'None'}:`);
        code.push('        pass');
    }
});


    }

    document.getElementById('output').textContent = code.join('\n');
}

// Get the corresponding visibility symbol for Java code generation
function getVisibilitySymbol(visibility) {
    if (visibility === 'private') return '-';
    if (visibility === 'public') return '+';
    if (visibility === 'protected') return '#';
    return '';
}

// Zoom in functionality
function zoomIn() {
    const currentScale = graph.view.scale;
    graph.zoomTo(currentScale * 1.2);
}

// Zoom out functionality
function zoomOut() {
    const currentScale = graph.view.scale;
    graph.zoomTo(currentScale * 0.8);
}

// Reset zoom functionality
function resetZoom() {
    graph.zoomTo(1);
}

// Initialize the graph on page load
document.addEventListener('DOMContentLoaded', () => {
    main();
});
