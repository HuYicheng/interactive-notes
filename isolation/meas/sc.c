#define _GNU_SOURCE
#include <stdio.h>
#include <time.h>
#include <unistd.h>
#include <sys/syscall.h>
static double now(){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return t.tv_sec+t.tv_nsec*1e-9;}
__attribute__((noinline)) int f(int x){__asm__ volatile("");return x+1;}
int main(){
  const long N=5000000; volatile long s=0; double t0=now();
  for(long i=0;i<N;i++) s+=f(i);
  double t1=now();
  for(long i=0;i<N;i++) s+=syscall(SYS_getppid);
  double t2=now();
  printf("function call: %.2f ns\nsyscall getppid: %.1f ns\n",(t1-t0)/N*1e9,(t2-t1)/N*1e9);
}
