import { useState, useRef, useEffect, type MutableRefObject } from 'react';

const CAP_MONTHLY = 50;

export function useSessionCap() {
  const [questionCount, setQuestionCount] = useState(0);
  const [sessionCap, setSessionCap] = useState(CAP_MONTHLY);
  const questionCountRef = useRef<number>(0) as MutableRefObject<number>;
  const sessionCapRef = useRef<number>(CAP_MONTHLY) as MutableRefObject<number>;

  useEffect(() => { questionCountRef.current = questionCount; }, [questionCount]);
  useEffect(() => { sessionCapRef.current = sessionCap; }, [sessionCap]);

  function increment() {
    setQuestionCount((prev) => prev + 1);
  }

  function reset() {
    setQuestionCount(0);
    questionCountRef.current = 0;
  }

  return {
    questionCount,
    questionCountRef,
    sessionCap,
    sessionCapRef,
    setSessionCap,
    sessionCapped: questionCount >= sessionCap,
    increment,
    reset,
  };
}
