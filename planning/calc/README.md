# Numbers quoted on page 17 · 第 17 篇里引用的数

- `calcnum.py` → `numbers.txt`: every number the page marks as "我们算的 / our arithmetic": the Nav2-style inflation
  costs on the kitchen costmap and NavFn's cell costs; grid search from the dock to the grasp pose (cells expanded by
  Dijkstra, A*, weighted A* and greedy best-first, path lengths and costs); where an illustrative potential field gets
  stuck; how hard a cup of water can be accelerated before it spills, its first slosh mode, and carry times with and
  without a jerk limit; FR3 joint move times at the datasheet limits; DWB's dynamic window and number of candidate
  trajectories; the expected costs of "grasp now" vs "look again"; and the time budget of fetching cup A.
  Run: `python3 calcnum.py > numbers.txt` (needs numpy and scipy).
- `check.js` → `check.txt`: the numbers quoted in the "你会看到 / What you will see" line under each interactive. It opens
  `planning/index.html` in a headless browser, operates each interactive the way a reader would (the buttons and
  sliders the "先玩 / Try first" prompt names) and compares the readouts with what the text says: the timeline of the
  whole task, where the greedy potential field gets stuck, the costmap and which side the path takes, cells expanded by
  the four grid searches, the sampling planners over 14 random seeds at three cabinet heights, trajectory optimisation
  from four initial guesses, the cup of water under three acceleration profiles, the local planner around a person,
  "grasp now" against "look again", the behaviour tree and its state-machine twin, the symbolic planner, SayCan, the
  planner-against-policy table, the failure ladder, the method map and the time budget.
  Run: `node check.js /absolute/path/to/planning/index.html > check.txt` (needs Node and Playwright; takes about 5 minutes).

The kitchen and the robot are fictional; the parts and the software defaults are real (ROS 2 Humble: Nav2, MoveIt 2,
BehaviorTree.CPP 3.8). Numbers marked "示意 / illustrative" on the page are made up for explanation and are not here.

厨房和机器人是虚构的，零件和软件默认值是真实的（ROS 2 Humble：Nav2、MoveIt 2、BehaviorTree.CPP 3.8）。
页面上标"示意"的数是为了讲清楚而编的，不在这里。

`check.js` 用无头浏览器打开页面，照着每个交互前面"先玩"里说的去点、去拉，把读数和交互后面"你会看到"里写的数逐个对照，
结果在 `check.txt` 里。它核对的是"正文和页面对得上"；交互里的模拟是页面自己的程序算的，其中标"示意"的时长和结果是设计出来的。
