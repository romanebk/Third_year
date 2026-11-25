##
## EPITECH PROJECT, 2026
## makefile
## File description:
## makefile
##

NAME		=	my_pgp

SRC_DIR		=	src

TESTS		=	tests

SRC			=	$(wildcard $(SRC_DIR)/*.c)

OBJ			=	$(SRC:.c=.o)

TEST_FILE	=	$(wildcard $(TESTS)/*.c)

UNIT_BIN	=	unit_tests

INCLUDE_DIR	=	include

CFLAGS		=	-g3 -Wall -Wextra -I$(INCLUDE_DIR)

OPTIM		=	-O2

LDFLAGS		=	-lcriterion --coverage -lgcov

all: $(NAME)

$(NAME): $(SRC)
	gcc -o $(NAME) $(SRC) $(CFLAGS) $(OPTIM)

unit_tests: $(TEST_FILE) $(filter-out $(SRC_DIR)/main.c, $(SRC))
	gcc -o $(UNIT_BIN) $(TEST_FILE) $(filter-out \
	$(SRC_DIR)/main.c,$(SRC)) $(CFLAGS) $(LDFLAGS)

tests_run:	unit_tests
	./$(UNIT_BIN) --verbose

functional_tests: $(NAME)
	sh $(TESTS)/functional_tests.sh

bonus:
	$(MAKE) -C bonus

bonus_tests: bonus
	$(MAKE) -C bonus tests_run

clean:
	rm -f *.o *~ *#
	rm -f $(SRC_DIR)/*.d
	rm -f $(SRC_DIR)/*.o
	rm -f *.gcno *.gcda
	$(MAKE) -C bonus clean

fclean: clean
	rm -f $(NAME) $(UNIT_BIN)
	$(MAKE) -C bonus fclean

re: fclean all

.PHONY: all re clean fclean unit_tests tests_run functional_tests bonus \
		bonus_tests
