import { useState, useRef, useEffect, type MutableRefObject } from 'react';

const CAP_MONTHLY = 200;

export function useSessionCap() {
  const [questionCount, setQuestionCount] = useState(0);
  const [sessionCap, setSessionCap] = useState(CAP_MONTHLY);
  const questionCountRef = useRef<number>(0) as MutableRefObject<number>;
  const sessionCapRef = useRef<number>(CAP_MONTHLY) as MutableRefObject<number>;

  useEffect(() => { sessionCapRef.current = sessionCap; }, [sessionCap]);

  function increment() {
    questionCountRef.current += 1;
    setQuestionCount(questionCountRef.current);
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
