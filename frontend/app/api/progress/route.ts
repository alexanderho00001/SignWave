import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';

interface ProgressData {
    lesson_slug: string;
    completed: boolean;
    score: number;
}

export async function POST(request: NextRequest) {
    try {
        // Get user ID from session cookie
        const sessionCookie = request.cookies.get('_signwave_session');
        const userCookie = request.cookies.get('_signwave_user');

        if (!sessionCookie && !userCookie) {
            return NextResponse.json(
                { error: 'Unauthorized - No session found' },
                { status: 401 }
            );
        }

        const userId = sessionCookie?.value || userCookie?.value;

        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized - Invalid session' },
                { status: 401 }
            );
        }

        // Parse request body
        const body: ProgressData = await request.json();
        const { lesson_slug, completed, score } = body;

        // Validate input
        if (!lesson_slug) {
            return NextResponse.json(
                { error: 'lesson_slug is required' },
                { status: 400 }
            );
        }

        if (typeof completed !== 'boolean') {
            return NextResponse.json(
                { error: 'completed must be a boolean' },
                { status: 400 }
            );
        }

        if (typeof score !== 'number') {
            return NextResponse.json(
                { error: 'score must be a number' },
                { status: 400 }
            );
        }

        // Check if progress already exists for this user and lesson
        const progressRef = collection(db, 'progress');
        const progressQuery = query(
            progressRef,
            where('user_id', '==', userId),
            where('lesson_slug', '==', lesson_slug)
        );
        const progressSnapshot = await getDocs(progressQuery);

        if (!progressSnapshot.empty) {
            // Update existing progress
            const existingDoc = progressSnapshot.docs[0];
            const existingData = existingDoc.data();
            const docRef = doc(db, 'progress', existingDoc.id);

            // Only update if new score is higher or completion status changed
            const shouldUpdate =
                score > (existingData.score || 0) ||
                (completed && !existingData.completed);

            if (shouldUpdate) {
                await updateDoc(docRef, {
                    completed,
                    score: Math.max(score, existingData.score || 0), // Keep the highest score
                    updated_at: Timestamp.now(),
                });

                return NextResponse.json({
                    success: true,
                    message: 'Progress updated successfully',
                    data: {
                        user_id: userId,
                        lesson_slug,
                        completed,
                        score: Math.max(score, existingData.score || 0),
                    },
                });
            } else {
                return NextResponse.json({
                    success: true,
                    message: 'Progress already recorded with higher or equal score',
                    data: existingData,
                });
            }
        } else {
            // Create new progress entry
            const progressData = {
                user_id: userId,
                lesson_slug,
                completed,
                score,
                created_at: Timestamp.now(),
                updated_at: Timestamp.now(),
            };

            const docRef = await addDoc(progressRef, progressData);

            return NextResponse.json({
                success: true,
                message: 'Progress saved successfully',
                data: {
                    id: docRef.id,
                    ...progressData,
                },
            }, { status: 201 });
        }
    } catch (error) {
        console.error('Error saving progress:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

// GET endpoint to retrieve user's progress
export async function GET(request: NextRequest) {
    try {
        // Get user ID from session cookie
        const sessionCookie = request.cookies.get('_signwave_session');
        const userCookie = request.cookies.get('_signwave_user');

        if (!sessionCookie && !userCookie) {
            return NextResponse.json(
                { error: 'Unauthorized - No session found' },
                { status: 401 }
            );
        }

        const userId = sessionCookie?.value || userCookie?.value;

        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized - Invalid session' },
                { status: 401 }
            );
        }

        // Get optional lesson_slug from query params
        const { searchParams } = new URL(request.url);
        const lessonSlug = searchParams.get('lesson_slug');

        const progressRef = collection(db, 'progress');
        let progressQuery;

        if (lessonSlug) {
            // Get progress for specific lesson
            progressQuery = query(
                progressRef,
                where('user_id', '==', userId),
                where('lesson_slug', '==', lessonSlug)
            );
        } else {
            // Get all progress for user
            progressQuery = query(
                progressRef,
                where('user_id', '==', userId)
            );
        }

        const progressSnapshot = await getDocs(progressQuery);
        const progressData = progressSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        return NextResponse.json({
            success: true,
            data: progressData,
        });
    } catch (error) {
        console.error('Error retrieving progress:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
