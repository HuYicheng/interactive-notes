// ipc.c — how long does it take to hand one message of S bytes from one process to another on the same machine?
// Four ways: a pipe, a Unix-domain socket, TCP over loopback, and shared memory (copy in / hand over in place).
// Each round: the sender passes S bytes, the receiver reads all S bytes (touching them), then answers with 1 byte.
// We report the median round-trip time over many rounds. Build: gcc -O2 -o ipc ipc.c
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <unistd.h>
#include <time.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/mman.h>
#include <sys/wait.h>
#include <sys/eventfd.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <arpa/inet.h>

static double now_us(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return t.tv_sec*1e6+t.tv_nsec/1e3;}
static int cmpd(const void*a,const void*b){double x=*(double*)a,y=*(double*)b;return x<y?-1:x>y;}
static void wr(int fd,const char*p,size_t n){while(n){ssize_t k=write(fd,p,n);if(k<=0){perror("write");exit(1);}p+=k;n-=k;}}
static void rd(int fd,char*p,size_t n){while(n){ssize_t k=read(fd,p,n);if(k<=0){perror("read");exit(1);}p+=k;n-=k;}}
static volatile uint64_t sink;
static void touch(const char*p,size_t n){uint64_t s=0;for(size_t i=0;i<n;i+=64)s+=p[i];sink+=s;}

// stream transport: fd pair a(parent side) b(child side)
static double run_stream(int pa,int pb_child,int pb_parent_ack,int ca_child,size_t S,int R){
  (void)pb_parent_ack;(void)ca_child;return 0;}

static int rounds_for(size_t S){return S<=4096?20000:S<=65536?5000:S<=1048576?600:300;}

static void report(const char*name,size_t S,double*t,int R){
  qsort(t,R,sizeof(double),cmpd);
  double med=t[R/2],p99=t[(int)(R*0.99)];
  printf("%-14s %9zu B  median %9.2f us  p99 %9.2f us  (%7.2f GB/s at median)\n",name,S,med,p99,S/(med*1e-6)/1e9);
  fflush(stdout);
}

// generic ping-pong over two connected stream fds (parent uses p, child uses c)
static void pingpong_stream(const char*name,int p,int c,size_t S){
  int R=rounds_for(S); char*buf=malloc(S+1); memset(buf,7,S);
  pid_t pid=fork();
  if(pid==0){close(p);char*in=malloc(S+1);char ack=1;for(int i=0;i<R+50;i++){rd(c,in,S);touch(in,S);wr(c,&ack,1);}_exit(0);}
  close(c);double*t=malloc(sizeof(double)*R);char a;
  for(int i=0;i<R+50;i++){double t0=now_us();wr(p,buf,S);rd(p,&a,1);double t1=now_us();if(i>=50)t[i-50]=t1-t0;}
  waitpid(pid,NULL,0);close(p);report(name,S,t,R);free(t);free(buf);
}

static void do_pipe(size_t S){int a[2],b[2];pipe(a);pipe(b);
  // emulate a bidirectional channel with two pipes
  int R=rounds_for(S);char*buf=malloc(S+1);memset(buf,7,S);
  pid_t pid=fork();
  if(pid==0){close(a[1]);close(b[0]);char*in=malloc(S+1);char ack=1;for(int i=0;i<R+50;i++){rd(a[0],in,S);touch(in,S);wr(b[1],&ack,1);}_exit(0);}
  close(a[0]);close(b[1]);double*t=malloc(sizeof(double)*R);char x;
  for(int i=0;i<R+50;i++){double t0=now_us();wr(a[1],buf,S);rd(b[0],&x,1);double t1=now_us();if(i>=50)t[i-50]=t1-t0;}
  waitpid(pid,NULL,0);report("pipe",S,t,R);free(t);free(buf);close(a[1]);close(b[0]);}

static void do_unix(size_t S){int sv[2];socketpair(AF_UNIX,SOCK_STREAM,0,sv);
  int sz=4<<20;setsockopt(sv[0],SOL_SOCKET,SO_SNDBUF,&sz,sizeof sz);setsockopt(sv[1],SOL_SOCKET,SO_RCVBUF,&sz,sizeof sz);
  pingpong_stream("unix socket",sv[0],sv[1],S);}

static void do_tcp(size_t S){
  int ls=socket(AF_INET,SOCK_STREAM,0);int one=1;setsockopt(ls,SOL_SOCKET,SO_REUSEADDR,&one,sizeof one);
  struct sockaddr_in ad={0};ad.sin_family=AF_INET;ad.sin_addr.s_addr=htonl(INADDR_LOOPBACK);ad.sin_port=0;
  bind(ls,(void*)&ad,sizeof ad);socklen_t L=sizeof ad;getsockname(ls,(void*)&ad,&L);listen(ls,1);
  int c=socket(AF_INET,SOCK_STREAM,0);connect(c,(void*)&ad,sizeof ad);int s=accept(ls,NULL,NULL);close(ls);
  setsockopt(c,IPPROTO_TCP,TCP_NODELAY,&one,sizeof one);setsockopt(s,IPPROTO_TCP,TCP_NODELAY,&one,sizeof one);
  pingpong_stream("tcp loopback",c,s,S);}

// shared memory: one big shared buffer + two eventfds for "message ready" and "ack"
static void do_shm(size_t S,int copy_in){
  int R=rounds_for(S);char*shm=mmap(NULL,S+64,PROT_READ|PROT_WRITE,MAP_SHARED|MAP_ANONYMOUS,-1,0);
  int ready=eventfd(0,0),ack=eventfd(0,0);char*src=malloc(S+1);memset(src,7,S);memset(shm,7,S);
  pid_t pid=fork();uint64_t one=1,v;
  if(pid==0){for(int i=0;i<R+50;i++){read(ready,&v,8);touch(shm,S);write(ack,&one,8);}_exit(0);}
  double*t=malloc(sizeof(double)*R);
  for(int i=0;i<R+50;i++){double t0=now_us();if(copy_in)memcpy(shm,src,S);else shm[0]=(char)i;write(ready,&one,8);read(ack,&v,8);double t1=now_us();if(i>=50)t[i-50]=t1-t0;}
  waitpid(pid,NULL,0);report(copy_in?"shm copy-in":"shm in place",S,t,R);free(t);free(src);munmap(shm,S+64);}

int main(int argc,char**argv){
  size_t sizes[]={64,4096,65536,1048576,2764800}; // 2,764,800 B = one 1280x720 RGB8 image
  for(int k=0;k<5;k++){size_t S=sizes[k];do_pipe(S);do_unix(S);do_tcp(S);do_shm(S,1);do_shm(S,0);puts("");}
  return 0;}
