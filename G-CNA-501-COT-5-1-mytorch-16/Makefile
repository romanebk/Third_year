##
## EPITECH PROJECT, 2026
## my_torch
## File description:
## Compilation de tout le projet.
## Dépend de : tous les fichiers sources
##

NAME_LIB	= libmytorch.a
NAME_CHESS	= libchess.a
ANALYZER	= my_torch_analyzer
GENERATOR	= my_torch_generator

CXX		= g++
CXXFLAGS	= -std=c++17 -O3 -Wall -Wextra -Iinclude -MMD -MP
BUILD		= build

# OpenMP parallélise le produit matriciel (bonus du sujet). Mettre OPENMP=0 pour
# compiler sans, sur une machine où libgomp n'est pas disponible.
OPENMP		?= 1
ifeq ($(OPENMP),1)
CXXFLAGS	+= -fopenmp
endif

# -march=native active AVX2/FMA : ~30 % de gain en plus sur le produit matriciel.
# Le binaire n'est alors valable que sur la machine de compilation (c'est le cas
# du rendu, qui recompile via le Makefile). Mettre NATIVE=0 pour un binaire portable.
NATIVE		?= 1
ifeq ($(NATIVE),1)
CXXFLAGS	+= -march=native
endif

# Deux archives séparées : libmytorch.a ne contient QUE le moteur générique
# (matrices, couches, entraînement, sérialisation) ; tout ce qui connaît les
# échecs (FEN, dataset, labels, augmentation) est dans libchess.a. Le module
# my_torch reste donc indépendant du projet d'échecs, y compris au niveau du
# binaire livré.
CORE_SRC	= $(wildcard src/mytorch/*.cpp)
CHESS_SRC	= $(wildcard src/chess/*.cpp)
LIB_SRC		= $(CORE_SRC) $(CHESS_SRC)
ANALYZER_SRC	= $(wildcard src/analyzer/*.cpp)
GENERATOR_SRC	= src/generator/main.cpp

CORE_OBJ	= $(CORE_SRC:src/%.cpp=$(BUILD)/%.o)
CHESS_OBJ	= $(CHESS_SRC:src/%.cpp=$(BUILD)/%.o)
LIB_OBJ		= $(CORE_OBJ) $(CHESS_OBJ)
ANALYZER_OBJ	= $(ANALYZER_SRC:src/%.cpp=$(BUILD)/%.o)
GENERATOR_OBJ	= $(GENERATOR_SRC:src/%.cpp=$(BUILD)/%.o)

# Un binaire n'est construit que si son main() est écrit (les .cpp ne contiennent
# que leur en-tête tant qu'ils n'ont pas été implémentés). Le motif ignore les
# commentaires qui parleraient de main() sans en définir un.
MAIN_PATTERN	= ^[[:space:]]*int[[:space:]]+main[[:space:]]*\(

TARGETS		= $(NAME_LIB) $(NAME_CHESS)
ifeq ($(shell grep -Eqs '$(MAIN_PATTERN)' src/analyzer/main.cpp && echo yes),yes)
TARGETS		+= $(ANALYZER)
endif
ifeq ($(shell grep -Eqs '$(MAIN_PATTERN)' src/generator/main.cpp && echo yes),yes)
TARGETS		+= $(GENERATOR)
endif

# Seuls les tests déjà écrits (qui ont un main()) sont compilés et lancés.
TEST_SRC	= $(shell grep -Els '$(MAIN_PATTERN)' tests/test_*.cpp)
TEST_BIN	= $(TEST_SRC:tests/%.cpp=$(BUILD)/tests/%)

all: $(TARGETS)

lib: $(NAME_LIB) $(NAME_CHESS)

tests: $(NAME_LIB) $(NAME_CHESS) $(TEST_BIN)
	@for t in $(TEST_BIN); do ./$$t || exit 1; done

# --start-group/--end-group : les archives statiques se référencent dans les
# deux sens (chess -> mytorch, jamais l'inverse), l'ordre n'a donc pas d'importance.
LDLIBS		= -L. -Wl,--start-group -lchess -lmytorch -Wl,--end-group

$(BUILD)/tests/%: tests/%.cpp $(NAME_LIB) $(NAME_CHESS)
	@mkdir -p $(@D)
	$(CXX) $(CXXFLAGS) $< -o $@ $(LDLIBS)

$(NAME_LIB): $(CORE_OBJ)
	ar rcs $@ $^

$(NAME_CHESS): $(CHESS_OBJ)
	ar rcs $@ $^

$(ANALYZER): $(ANALYZER_OBJ) $(NAME_LIB) $(NAME_CHESS)
	$(CXX) $(CXXFLAGS) -o $@ $(ANALYZER_OBJ) $(LDLIBS)

$(GENERATOR): $(GENERATOR_OBJ) $(NAME_LIB) $(NAME_CHESS)
	$(CXX) $(CXXFLAGS) -o $@ $(GENERATOR_OBJ) $(LDLIBS)

$(BUILD)/%.o: src/%.cpp
	@mkdir -p $(@D)
	$(CXX) $(CXXFLAGS) -c $< -o $@

clean:
	rm -rf $(BUILD)

fclean: clean
	rm -f $(NAME_LIB) $(NAME_CHESS) $(ANALYZER) $(GENERATOR)

re: fclean all

# Recompilation instrumentée (AddressSanitizer + UBSan) puis exécution des tests.
# .NOTPARALLEL évite que fclean supprime build/ pendant que les objets se compilent.
.NOTPARALLEL: debug
debug: CXXFLAGS += -g -O0 -fsanitize=address,undefined -fno-omit-frame-pointer
debug: re tests

-include $(LIB_OBJ:.o=.d) $(ANALYZER_OBJ:.o=.d) $(GENERATOR_OBJ:.o=.d)

.PHONY: all lib tests clean fclean re debug
