export const COLLECTION_NAME = 'secure_gamestate_v1';

export const COLUMNS = [
    'col_1', // Player Data (Transform, Health, etc)
    'col_2', // Reserved
    'col_3', // Reserved
    'col_4', // Reserved
    'col_5', // Reserved
    'col_6', // Reserved
    'col_7', // Reserved
    'col_8', // Reserved
    'col_9', // Reserved
    'col_10' // Reserved
];

export const MSG_TYPES = {
    JOIN_REQUEST: 'join_request',
    INPUT_UPDATE: 'input_update'
};

export function createEmptyRow(playerId) {
    const row = {
        player_id: playerId,
        last_updated: Date.now()
    };
    
    COLUMNS.forEach(col => {
        row[col] = {};
    });

    // Initialize col_1 with default spawn data
    row.col_1 = {
        x: (Math.random() - 0.5) * 10,
        y: 1,
        z: (Math.random() - 0.5) * 10,
        color: '#' + Math.floor(Math.random()*16777215).toString(16),
        active: true
    };

    return row;
}

