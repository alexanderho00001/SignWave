export interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    username: string;
    password: string;
}

export interface Room {
    id: string;
    room_code: string;
    host_id: string;
    guest_id: string;
    is_started: boolean;
    is_finished: boolean;
    host_score: number;
    guest_score: number;
    host_name: string;
    guest_name: string;
    host_skipped: boolean;
    guest_skipped: boolean;
    host_given_up: boolean;
    guest_given_up: boolean;
    goal_score: number;
    current_problem?: {
        type: 'alphabet' | 'number' | 'word';
        question: string;
        answer: string | number;
    };
    last_solved_by?: string; // user_id of who solved the last problem
    created_at: string;
}
