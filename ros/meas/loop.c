// loop.c — a 1 kHz loop: wake up every 1 ms (absolute deadlines) and record how late each wake-up was.
// Usage: ./loop N [fifo]   (N iterations; "fifo" = run with SCHED_FIFO priority 80 if allowed)
// Output: one lateness value per line in microseconds (to stdout), summary on stderr. Build: gcc -O2 -o loop loop.c
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <sched.h>
#include <sys/mman.h>
static int cmpd(const void*a,const void*b){double x=*(double*)a,y=*(double*)b;return x<y?-1:x>y;}
int main(int argc,char**argv){
  int N=argc>1?atoi(argv[1]):10000;
  if(argc>2&&!strcmp(argv[2],"fifo")){struct sched_param p={.sched_priority=80};
    if(sched_setscheduler(0,SCHED_FIFO,&p))perror("sched_setscheduler");mlockall(MCL_CURRENT|MCL_FUTURE);}
  double*late=malloc(sizeof(double)*N);struct timespec next,t;clock_gettime(CLOCK_MONOTONIC,&next);
  for(int i=0;i<N;i++){
    next.tv_nsec+=1000000;if(next.tv_nsec>=1000000000){next.tv_nsec-=1000000000;next.tv_sec++;}
    clock_nanosleep(CLOCK_MONOTONIC,TIMER_ABSTIME,&next,NULL);
    clock_gettime(CLOCK_MONOTONIC,&t);
    late[i]=(t.tv_sec-next.tv_sec)*1e6+(t.tv_nsec-next.tv_nsec)/1e3;
    // a little control work: 200 multiply-adds, like one small controller update
    volatile double acc=0;for(int k=0;k<200;k++)acc+=k*0.5;
  }
  for(int i=0;i<N;i++)printf("%.2f\n",late[i]);
  qsort(late,N,sizeof(double),cmpd);
  fprintf(stderr,"C loop: N=%d median %.1f us, p99 %.1f us, p99.9 %.1f us, max %.1f us\n",N,late[N/2],late[(int)(N*0.99)],late[(int)(N*0.999)],late[N-1]);
  return 0;}
